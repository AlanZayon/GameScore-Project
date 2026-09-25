namespace GameScore.Domain.Scoring;

public static class Reputation
{
    public const int Min = 0;
    public const int Max = 5000;

    public static readonly IReadOnlyDictionary<string, int> Deltas = new Dictionary<string, int>
    {
        ["USEFUL_VOTE_RECEIVED"] = 2,
        ["NOT_USEFUL_VOTE_RECEIVED"] = -1,
        ["USEFUL_VOTE_REMOVED"] = -2,
        ["NOT_USEFUL_VOTE_REMOVED"] = 1,
        ["REVIEW_PUBLISHED"] = 1,
        ["REVIEW_DELETED"] = -1,
        ["REVIEW_REMOVED_BY_MODERATOR"] = -25,
        ["ABUSE_CONFIRMED"] = -50,
    };

    public static readonly HashSet<string> SensitiveReasons = new(StringComparer.Ordinal)
    {
        "REVIEW_REMOVED_BY_MODERATOR",
        "ABUSE_CONFIRMED",
    };

    public static bool IsSensitiveReason(string reason) => SensitiveReasons.Contains(reason);

    public static int Clamp(int value)
    {
        if (value < Min) return Min;
        if (value > Max) return Max;
        return value;
    }

    public static int ApplyDelta(int current, string reason)
    {
        if (!Deltas.TryGetValue(reason, out var delta))
        {
            throw new ArgumentException($"Unknown reputation reason: {reason}", nameof(reason));
        }

        return Clamp(current + delta);
    }

    public static string Tier(int score)
    {
        var clamped = Clamp(score);
        if (clamped >= 3000) return "ELITE";
        if (clamped >= 1500) return "RESPECTED";
        if (clamped >= 500) return "ESTABLISHED";
        if (clamped >= 200) return "TRUSTED";
        if (clamped >= 50) return "ACTIVE";
        return "NEWCOMER";
    }

    public static double RankingWeightRatio(int score)
    {
        var clamped = Math.Max(0, Clamp(score));
        return Math.Min(1, clamped / ReviewScoreCalculator.ReputationSoftCap);
    }
}
