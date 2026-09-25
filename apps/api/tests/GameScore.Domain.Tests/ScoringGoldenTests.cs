using FluentAssertions;
using GameScore.Domain.Scoring;
using GameScore.Domain.Utils;

namespace GameScore.Domain.Tests;

public class ScoringGoldenTests
{
    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(1, 0, 0.206543)]
    [InlineData(10, 0, 0.722482)]
    [InlineData(100, 0, 0.963543)]
    [InlineData(50, 50, 0.403775)]
    [InlineData(90, 10, 0.824739)]
    public void Wilson_lower_bound_matches_known_values(int positive, int negative, double expected)
    {
        var actual = Wilson.LowerBound(positive, negative);
        actual.Should().BeApproximately(expected, 0.001);
    }

    [Fact]
    public void CalculateGameScore_empty_is_zero()
    {
        var result = GameScoreCalculator.Calculate(new RecommendationCounts(0, 0));
        result.TotalReviews.Should().Be(0);
        result.PositivePercentage.Should().Be(0);
        result.ConfidenceScore.Should().Be(0);
        result.Label.Should().Be(ScoreLabels.NoReviews);
    }

    [Fact]
    public void CalculateGameScore_few_reviews_label()
    {
        var result = GameScoreCalculator.Calculate(new RecommendationCounts(5, 0));
        result.PositivePercentage.Should().Be(100);
        result.Label.Should().Be(ScoreLabels.FewReviews);
    }

    [Fact]
    public void CalculateGameScore_very_positive()
    {
        var result = GameScoreCalculator.Calculate(new RecommendationCounts(90, 10));
        result.PositivePercentage.Should().Be(90);
        result.Label.Should().Be(ScoreLabels.VeryPositive);
    }

    [Fact]
    public void Reputation_deltas_and_clamp()
    {
        Reputation.ApplyDelta(0, "REVIEW_PUBLISHED").Should().Be(1);
        Reputation.ApplyDelta(10, "USEFUL_VOTE_RECEIVED").Should().Be(12);
        Reputation.Clamp(-5).Should().Be(0);
        Reputation.Clamp(99999).Should().Be(5000);
        Reputation.Tier(0).Should().Be("NEWCOMER");
        Reputation.Tier(3000).Should().Be("ELITE");
    }

    [Fact]
    public void ReviewBomb_detects_negative_spike()
    {
        var history = Enumerable.Range(0, 30)
            .Select(i => new DailyReviewActivity($"2024-01-{i + 1:00}", 2, 1))
            .ToList();
        var day = new DailyReviewActivity("2024-02-01", 5, 95);
        var assessment = ReviewBombDetector.Assess(day, history);
        assessment.Anomalous.Should().BeTrue();
        assessment.Direction.Should().Be("NEGATIVE");
    }

    [Fact]
    public void Slugify_basic()
    {
        Slug.Slugify("Elden Ring").Should().Be("elden-ring");
        Slug.Slugify("Hades II").Should().Be("hades-ii");
        Slug.IsValid("elden-ring").Should().BeTrue();
    }

    [Fact]
    public void ReviewScore_produces_finite_total()
    {
        var score = ReviewScoreCalculator.Calculate(new ReviewScoreInput(
            UsefulVotes: 10,
            NotUsefulVotes: 2,
            AuthorReputation: 100,
            TextLength: 300,
            HoursPlayed: 12,
            Rating: 8,
            AgeInDays: 10));
        score.Total.Should().BeGreaterThan(0);
        double.IsFinite(score.Total).Should().BeTrue();
    }
}
