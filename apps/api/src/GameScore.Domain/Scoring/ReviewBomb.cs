namespace GameScore.Domain.Scoring;

public sealed record DailyReviewActivity(string Date, int Positive, int Negative);

public sealed record ReviewBombAssessment(
    bool Anomalous,
    string Direction,
    int Observed,
    int Positive,
    int Negative,
    double BaselinePerDay,
    double VolumeRatio,
    double DominantShare,
    double Severity);

public static class ReviewBombDetector
{
    public const int MinAbsoluteReviews = 20;
    public const double VolumeRatioThreshold = 5;
    public const double NegativeShareThreshold = 0.7;
    public const double PositiveShareThreshold = 0.9;
    public const int BaselineWindowDays = 30;

    public static double CalculateBaselinePerDay(IReadOnlyList<DailyReviewActivity> history)
    {
        var totals = history.Select(d => d.Positive + d.Negative).ToList();
        return Median(totals);
    }

    public static ReviewBombAssessment Assess(
        DailyReviewActivity day,
        IReadOnlyList<DailyReviewActivity> baselineHistory)
    {
        var positive = Math.Max(0, day.Positive);
        var negative = Math.Max(0, day.Negative);
        var observed = positive + negative;

        var baselinePerDay = CalculateBaselinePerDay(baselineHistory);
        var effectiveBaseline = Math.Max(baselinePerDay, 1);
        var volumeRatio = observed == 0 ? 0 : observed / effectiveBaseline;

        var negativeShare = observed == 0 ? 0.0 : negative / (double)observed;
        var positiveShare = observed == 0 ? 0.0 : positive / (double)observed;

        var isNegativeSpike = negativeShare >= NegativeShareThreshold;
        var isPositiveSpike = positiveShare >= PositiveShareThreshold;

        var meetsVolume =
            observed >= MinAbsoluteReviews &&
            volumeRatio >= VolumeRatioThreshold;

        var direction = !meetsVolume
            ? "NONE"
            : isNegativeSpike
                ? "NEGATIVE"
                : isPositiveSpike
                    ? "POSITIVE"
                    : "NONE";

        var anomalous = direction != "NONE";
        var dominantShare = direction == "POSITIVE" ? positiveShare : negativeShare;

        var ratioComponent = Clamp01(Math.Min(volumeRatio, 50) / 50);
        var shareComponent = Clamp01((dominantShare - 0.5) / 0.5);
        var severity = anomalous ? Clamp01(ratioComponent * 0.6 + shareComponent * 0.4) : 0;

        return new ReviewBombAssessment(
            Anomalous: anomalous,
            Direction: direction,
            Observed: observed,
            Positive: positive,
            Negative: negative,
            BaselinePerDay: baselinePerDay,
            VolumeRatio: double.IsFinite(volumeRatio) ? Math.Min(volumeRatio, 1000) : 0,
            DominantShare: dominantShare,
            Severity: severity);
    }

    private static double Median(IReadOnlyList<int> values)
    {
        if (values.Count == 0) return 0;
        var sorted = values.OrderBy(v => v).ToList();
        var middle = sorted.Count / 2;
        if (sorted.Count % 2 == 1)
        {
            return sorted[middle];
        }

        return (sorted[middle - 1] + sorted[middle]) / 2.0;
    }

    private static double Clamp01(double value) => Math.Min(1, Math.Max(0, value));
}
