using System.Collections.Concurrent;
using System.Text.Json;
using GameScore.Application.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace GameScore.Infrastructure.Cache;

public sealed class CacheService
{
    private readonly IMemoryCache _memory;
    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<CacheService> _logger;
    private readonly ConcurrentDictionary<string, byte> _memoryKeys = new();

    public CacheService(
        IMemoryCache memory,
        IOptions<AppConfig> config,
        ILogger<CacheService> logger,
        IConnectionMultiplexer? redis = null)
    {
        _memory = memory;
        _redis = redis;
        _logger = logger;
        if (redis is null && config.Value.RedisUrl is not null)
        {
            _logger.LogWarning("REDIS_URL is set but Redis connection failed; using memory cache only.");
        }
    }

    public bool RedisAvailable => _redis?.IsConnected == true;

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        if (_redis?.IsConnected == true)
        {
            var db = _redis.GetDatabase();
            var value = await db.StringGetAsync(key);
            if (value.HasValue)
            {
                return JsonSerializer.Deserialize<T>((string)value!);
            }
        }

        return _memory.TryGetValue(key, out T? cached) ? cached : default;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        _memory.Set(key, value, ttl);
        _memoryKeys.TryAdd(key, 0);

        if (_redis?.IsConnected == true)
        {
            var db = _redis.GetDatabase();
            await db.StringSetAsync(key, JsonSerializer.Serialize(value), ttl);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        _memory.Remove(key);
        _memoryKeys.TryRemove(key, out _);
        if (_redis?.IsConnected == true)
        {
            await _redis.GetDatabase().KeyDeleteAsync(key);
        }
    }

    public async Task RemoveByPrefixAsync(string prefix, CancellationToken cancellationToken = default)
    {
        foreach (var key in _memoryKeys.Keys.Where(k => k.StartsWith(prefix, StringComparison.Ordinal)))
        {
            _memory.Remove(key);
            _memoryKeys.TryRemove(key, out _);
        }

        if (_redis?.IsConnected != true)
        {
            return;
        }

        // Managed Redis often rejects KEYS/SCAN against replicas or restricted ACLs.
        // Cache drift is preferable to failing a request that already committed.
        try
        {
            var server = _redis.GetServers().FirstOrDefault(s => s.IsConnected && !s.IsReplica);
            if (server is null)
            {
                return;
            }

            var db = _redis.GetDatabase();
            foreach (var key in server.Keys(pattern: $"{prefix}*"))
            {
                await db.KeyDeleteAsync(key);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to invalidate Redis keys with prefix {Prefix}", prefix);
        }
    }
}
