namespace GameScore.Domain.Scoring;

public static class ScoreLabels
{
    public const string NoReviews = "NO_REVIEWS";
    public const string FewReviews = "FEW_REVIEWS";
    public const string OverwhelminglyPositive = "OVERWHELMINGLY_POSITIVE";
    public const string VeryPositive = "VERY_POSITIVE";
    public const string Positive = "POSITIVE";
    public const string MostlyPositive = "MOSTLY_POSITIVE";
    public const string Mixed = "MIXED";
    public const string MostlyNegative = "MOSTLY_NEGATIVE";
    public const string Negative = "NEGATIVE";
    public const string VeryNegative = "VERY_NEGATIVE";

    public const int DefaultMinimumReviews = 10;
    public const int OverwhelmingMinimumReviews = 200;

    public static string Resolve(
        double positivePercentage,
        int totalReviews,
        int minimumReviews = DefaultMinimumReviews)
    {
        if (totalReviews <= 0)
        {
            return NoReviews;
        }

        if (totalReviews < minimumReviews)
        {
            return FewReviews;
        }

        if (positivePercentage >= 95 && totalReviews >= OverwhelmingMinimumReviews)
        {
            return OverwhelminglyPositive;
        }

        if (positivePercentage >= 85)
        {
            return VeryPositive;
        }

        if (positivePercentage >= 75)
        {
            return Positive;
        }

        if (positivePercentage >= 60)
        {
            return MostlyPositive;
        }

        if (positivePercentage >= 45)
        {
            return Mixed;
        }

        if (positivePercentage >= 30)
        {
            return MostlyNegative;
        }

        if (positivePercentage >= 15)
        {
            return Negative;
        }

        return VeryNegative;
    }

    public static string ResolveSentiment(string label) => label switch
    {
        OverwhelminglyPositive or VeryPositive or Positive or MostlyPositive => "positive",
        Mixed => "mixed",
        MostlyNegative or Negative or VeryNegative => "negative",
        _ => "unknown",
    };
}
