package repository

import (
	"time"

	"github.com/uaad/backend/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// RecommendationItem is a denormalized projection used by recommendation APIs.
type RecommendationItem struct {
	ActivityID   uint64
	Title        string
	CoverURL     *string
	Category     string
	Location     string
	Price        float64
	EnrollOpenAt time.Time
	Score        float64
	Rank         int
}

// RecommendationRepository defines data access for recommendation use cases.
type RecommendationRepository interface {
	ListHotActivities(limit, offset int) ([]RecommendationItem, error)
	ListFreshActivities(limit int) ([]RecommendationItem, error)
	CountUserBehaviors(userID uint64) (int64, error)
	ListUserInteractedActivityIDs(userID uint64, limit int) ([]uint64, error)
	ListPreferredCategories(userID uint64, limit int) ([]string, error)
	ListSimilarActivitiesBySeed(seedActivityIDs []uint64, limit int) ([]RecommendationItem, error)
	ListHotActivitiesByCategories(categories []string, limit int) ([]RecommendationItem, error)
	ListPublishedActivitiesForScoring() ([]domain.Activity, error)
	UpsertActivityScore(activityID uint64, score float64, components string, calculatedAt time.Time) error
	UpdateScoreRanks() error
}

type recommendationRepository struct {
	db *gorm.DB
}

func NewRecommendationRepository(db *gorm.DB) RecommendationRepository {
	return &recommendationRepository{db: db}
}

func (r *recommendationRepository) ListHotActivities(limit, offset int) ([]RecommendationItem, error) {
	var out []RecommendationItem
	err := r.db.Table("activities a").
		Select("a.id AS activity_id, a.title, a.cover_url, a.category, a.location, a.price, a.enroll_open_at, COALESCE(s.score, 0) AS score, COALESCE(s.`rank`, 0) AS `rank`").
		Joins("LEFT JOIN activity_scores s ON s.activity_id = a.id").
		Where("a.status = ?", "PUBLISHED").
		Order("COALESCE(s.score, 0) DESC, a.enroll_count DESC, a.view_count DESC, a.id DESC").
		Limit(limit).
		Offset(offset).
		Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *recommendationRepository) ListFreshActivities(limit int) ([]RecommendationItem, error) {
	var out []RecommendationItem
	err := r.db.Table("activities a").
		Select("a.id AS activity_id, a.title, a.cover_url, a.category, a.location, a.price, a.enroll_open_at, COALESCE(s.score, 0) AS score, COALESCE(s.`rank`, 0) AS `rank`").
		Joins("LEFT JOIN activity_scores s ON s.activity_id = a.id").
		Where("a.status = ?", "PUBLISHED").
		Order("a.created_at DESC, a.id DESC").
		Limit(limit).
		Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *recommendationRepository) CountUserBehaviors(userID uint64) (int64, error) {
	var count int64
	err := r.db.Model(&domain.UserBehavior{}).Where("user_id = ?", userID).Count(&count).Error
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (r *recommendationRepository) ListUserInteractedActivityIDs(userID uint64, limit int) ([]uint64, error) {
	var rows []struct {
		ActivityID uint64
	}
	err := r.db.Table("user_behaviors").
		Select("activity_id").
		Where("user_id = ?", userID).
		Group("activity_id").
		Order("MAX(created_at) DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]uint64, 0, len(rows))
	for i := range rows {
		out = append(out, rows[i].ActivityID)
	}
	return out, nil
}

func (r *recommendationRepository) ListPreferredCategories(userID uint64, limit int) ([]string, error) {
	var rows []struct {
		Category string
	}
	err := r.db.Table("user_behaviors ub").
		Select("a.category AS category").
		Joins("JOIN activities a ON a.id = ub.activity_id").
		Where("ub.user_id = ? AND a.status = ?", userID, "PUBLISHED").
		Group("a.category").
		Order("COUNT(1) DESC, MAX(ub.created_at) DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for i := range rows {
		if rows[i].Category != "" {
			out = append(out, rows[i].Category)
		}
	}
	return out, nil
}

func (r *recommendationRepository) ListSimilarActivitiesBySeed(seedActivityIDs []uint64, limit int) ([]RecommendationItem, error) {
	if len(seedActivityIDs) == 0 {
		return []RecommendationItem{}, nil
	}

	var out []RecommendationItem
	err := r.db.Raw(
		"SELECT a.id AS activity_id, a.title, a.cover_url, a.category, a.location, a.price, a.enroll_open_at, "+
			"COALESCE(s.score, 0) AS score, COALESCE(s.`rank`, 0) AS `rank` "+
			"FROM ("+
			"SELECT b.activity_id, COUNT(DISTINCT a.user_id) AS common_users "+
			"FROM user_behaviors a "+
			"JOIN user_behaviors b ON a.user_id = b.user_id AND a.activity_id IN ? AND b.activity_id NOT IN ? "+
			"WHERE a.behavior_type IN ('VIEW','COLLECT','SHARE','CLICK','SEARCH') "+
			"AND b.behavior_type IN ('VIEW','COLLECT','SHARE','CLICK','SEARCH') "+
			"GROUP BY b.activity_id ORDER BY common_users DESC LIMIT ?"+
			") cf "+
			"JOIN activities a ON a.id = cf.activity_id "+
			"LEFT JOIN activity_scores s ON s.activity_id = a.id "+
			"WHERE a.status = 'PUBLISHED' "+
			"ORDER BY cf.common_users DESC, COALESCE(s.score, 0) DESC, a.enroll_count DESC, a.id DESC",
		seedActivityIDs, seedActivityIDs, limit,
	).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *recommendationRepository) ListHotActivitiesByCategories(categories []string, limit int) ([]RecommendationItem, error) {
	if len(categories) == 0 {
		return []RecommendationItem{}, nil
	}
	var out []RecommendationItem
	err := r.db.Table("activities a").
		Select("a.id AS activity_id, a.title, a.cover_url, a.category, a.location, a.price, a.enroll_open_at, COALESCE(s.score, 0) AS score, COALESCE(s.`rank`, 0) AS `rank`").
		Joins("LEFT JOIN activity_scores s ON s.activity_id = a.id").
		Where("a.status = ?", "PUBLISHED").
		Where("a.category IN ?", categories).
		Order("COALESCE(s.score, 0) DESC, a.enroll_count DESC, a.view_count DESC, a.id DESC").
		Limit(limit).
		Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *recommendationRepository) ListPublishedActivitiesForScoring() ([]domain.Activity, error) {
	var activities []domain.Activity
	err := r.db.Where("status = ?", "PUBLISHED").Find(&activities).Error
	if err != nil {
		return nil, err
	}
	return activities, nil
}

func (r *recommendationRepository) UpsertActivityScore(activityID uint64, score float64, components string, calculatedAt time.Time) error {
	rec := domain.ActivityScore{
		ActivityID:      activityID,
		Score:           score,
		ScoreComponents: components,
		CalculatedAt:    calculatedAt,
	}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "activity_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"score", "score_components", "calculated_at"}),
	}).Create(&rec).Error
}

func (r *recommendationRepository) UpdateScoreRanks() error {
	var rows []struct {
		ActivityID uint64
	}
	if err := r.db.Model(&domain.ActivityScore{}).
		Select("activity_id").
		Order("score DESC, activity_id ASC").
		Find(&rows).Error; err != nil {
		return err
	}
	for i := range rows {
		rank := i + 1
		if err := r.db.Model(&domain.ActivityScore{}).
			Where("activity_id = ?", rows[i].ActivityID).
			Update("rank", rank).Error; err != nil {
			return err
		}
	}
	return nil
}
