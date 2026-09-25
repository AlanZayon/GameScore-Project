namespace GameScore.Domain.Scoring;

public static class Wilson
{
    public const double Z95 = 1.959963984540054;
    public const double Z90 = 1.6448536269514722;

    public static double LowerBound(double positive, double negative, double z = Z95)
    {
        AssertCount(positive, nameof(positive));
        AssertCount(negative, nameof(negative));

        var total = positive + negative;
        if (total == 0)
        {
            return 0;
        }

        var observed = positive / total;
        var zSquared = z * z;
        var centre = observed + zSquared / (2 * total);
        var margin = z * Math.Sqrt((observed * (1 - observed) + zSquared / (4 * total)) / total);
        var denominator = 1 + zSquared / total;

        return ClampUnit((centre - margin) / denominator);
    }

    public static double UpperBound(double positive, double negative, double z = Z95)
    {
        AssertCount(positive, nameof(positive));
        AssertCount(negative, nameof(negative));

        var total = positive + negative;
        if (total == 0)
        {
            return 0;
        }

        var observed = positive / total;
        var zSquared = z * z;
        var centre = observed + zSquared / (2 * total);
        var margin = z * Math.Sqrt((observed * (1 - observed) + zSquared / (4 * total)) / total);
        var denominator = 1 + zSquared / total;

        return ClampUnit((centre + margin) / denominator);
    }

    private static void AssertCount(double value, string name)
    {
        if (!double.IsFinite(value) || value < 0)
        {
            throw new ArgumentOutOfRangeException(name, value, $"{name} must be a finite number >= 0");
        }
    }

    private static double ClampUnit(double value) =>
        value < 0 ? 0 : value > 1 ? 1 : value;
}
