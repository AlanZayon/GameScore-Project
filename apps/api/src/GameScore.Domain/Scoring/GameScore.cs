namespace GameScore.Domain.Scoring;

public sealed record RecommendationCounts(int Positive, int Negative);

public sealed record GameScoreResult(
    int TotalReviews,
    int PositiveReviews,
    int NegativeReviews,
    double PositivePercentage,
    double WilsonLowerBound,
    double ConfidenceScore,
    string Label);

public static class GameScoreCalculator
{
    public static double RoundTo(double value, int decimals)
    {
        var factor = Math.Pow(10, decimals);
        return Math.Round(value * factor, MidpointRounding.AwayFromZero) / factor;
    }

    public static GameScoreResult Calculate(
        RecommendationCounts counts,
        int minimumReviewsForLabel = ScoreLabels.DefaultMinimumReviews)
    {
        var positive = Math.Max(0, counts.Positive);
        var negative = Math.Max(0, counts.Negative);
        var total = positive + negative;

        var positivePercentage = total == 0 ? 0 : RoundTo((positive / (double)total) * 100, 2);
        var lowerBound = Wilson.LowerBound(positive, negative);

        return new GameScoreResult(
            TotalReviews: total,
            PositiveReviews: positive,
            NegativeReviews: negative,
            PositivePercentage: positivePercentage,
            WilsonLowerBound: RoundTo(lowerBound, 6),
            ConfidenceScore: RoundTo(lowerBound * 100, 4),
            Label: ScoreLabels.Resolve(positivePercentage, total, minimumReviewsForLabel));
    }
}
