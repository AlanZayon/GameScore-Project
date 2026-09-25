namespace GameScore.Domain.Scoring;

public sealed record ReviewScoreInput(
    int UsefulVotes,
    int NotUsefulVotes,
    int AuthorReputation,
    int TextLength,
    double? HoursPlayed,
    double? Rating,
    double AgeInDays);

public sealed record ReviewScoreBreakdown(
    double UsefulnessWeight,
    double VolumeWeight,
    double ReputationWeight,
    double QualityWeight,
    double RecencyWeight,
    double Total);

public static class ReviewScoreCalculator
{
    public const double MaxUsefulness = 50;
    public const double MaxVolume = 15;
    public const double MaxReputation = 15;
    public const double MaxQuality = 12;
    public const double MaxRecency = 10;
    public const double ReputationSoftCap = 500;
    public const double RecencyHalfLifeDays = 90;

    public static ReviewScoreBreakdown Calculate(ReviewScoreInput input)
    {
        var useful = Math.Max(0, input.UsefulVotes);
        var notUseful = Math.Max(0, input.NotUsefulVotes);

        var usefulness = UsefulnessWeight(useful, notUseful);
        var volume = VolumeWeight(useful + notUseful);
        var reputation = ReputationWeight(input.AuthorReputation);
        var quality = QualityWeight(input);
        var recency = RecencyWeight(input.AgeInDays);
        var total = usefulness + volume + reputation + quality + recency;

        return new ReviewScoreBreakdown(
            GameScoreCalculator.RoundTo(usefulness, 4),
            GameScoreCalculator.RoundTo(volume, 4),
            GameScoreCalculator.RoundTo(reputation, 4),
            GameScoreCalculator.RoundTo(quality, 4),
            GameScoreCalculator.RoundTo(recency, 4),
            GameScoreCalculator.RoundTo(total, 4));
    }

    public static double CalculateValue(ReviewScoreInput input) => Calculate(input).Total;

    private static double UsefulnessWeight(int usefulVotes, int notUsefulVotes) =>
        Wilson.LowerBound(usefulVotes, notUsefulVotes) * MaxUsefulness;

    private static double VolumeWeight(int totalVotes) =>
        Clamp(5 * Math.Log10(1 + Math.Max(0, totalVotes)), 0, MaxVolume);

    private static double ReputationWeight(int authorReputation)
    {
        var normalised = Math.Max(0, authorReputation) / ReputationSoftCap;
        return Clamp(normalised * MaxReputation, 0, MaxReputation);
    }

    private static double QualityWeight(ReviewScoreInput input)
    {
        double score = 0;
        var length = Math.Max(0, input.TextLength);
        if (length >= 1200) score += 6;
        else if (length >= 600) score += 5;
        else if (length >= 250) score += 4;
        else if (length >= 120) score += 3;
        else if (length >= 60) score += 2;
        else if (length >= 20) score += 1;

        if (input.HoursPlayed is > 0) score += 2;
        if (input.HoursPlayed is >= 10) score += 2;
        if (input.Rating is not null) score += 2;

        return Clamp(score, 0, MaxQuality);
    }

    private static double RecencyWeight(double ageInDays)
    {
        var age = Math.Max(0, ageInDays);
        return MaxRecency * Math.Exp(-age / RecencyHalfLifeDays);
    }

    private static double Clamp(double value, double min, double max) =>
        Math.Min(max, Math.Max(min, value));
}
