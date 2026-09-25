using Isopoh.Cryptography.Argon2;

namespace GameScore.Infrastructure.Auth;

public sealed class PasswordHasher
{
    private const int MemoryCost = 19_456;
    private const int TimeCost = 2;
    private const int Parallelism = 1;

    public Task<string> HashAsync(string plainPassword, CancellationToken cancellationToken = default) =>
        Task.FromResult(Argon2.Hash(plainPassword, type: Argon2Type.HybridAddressing, memoryCost: MemoryCost, timeCost: TimeCost, parallelism: Parallelism));

    public Task<bool> VerifyAsync(string passwordHash, string plainPassword, CancellationToken cancellationToken = default)
    {
        try
        {
            return Task.FromResult(Argon2.Verify(passwordHash, plainPassword));
        }
        catch
        {
            return Task.FromResult(false);
        }
    }
}
