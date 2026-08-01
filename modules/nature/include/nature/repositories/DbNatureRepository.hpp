/**
 *
 * @file DbNatureRepository.hpp
 * @author Softadastra
 * @brief Database-backed repository for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_REPOSITORIES_DB_NATURE_REPOSITORY_HPP_INCLUDED
#define ORELUNZA_NATURE_REPOSITORIES_DB_NATURE_REPOSITORY_HPP_INCLUDED

#include <nature/repositories/NatureRepository.hpp>
#include <vix/db/Database.hpp>

namespace orelunza::nature::repositories
{
  /**
   * @brief Stores nature data using a Vix database.
   */
  class DbNatureRepository final : public NatureRepository
  {
  public:
    /**
     * @brief Construct the repository and initialize its schema.
     *
     * @param database Shared application database.
     */
    explicit DbNatureRepository(
        vix::db::Database &database);

    /**
     * @brief Return whether the repository is ready.
     *
     * @return true when schema initialization succeeded.
     */
    [[nodiscard]] bool ready() const noexcept;

    /**
     * @brief Return the schema initialization status.
     *
     * @return Schema status.
     */
    [[nodiscard]] const RepositoryStatus &
    schema_status() const noexcept;

    RepositoryStatus create_biome(
        const domain::Biome &biome) override;

    RepositoryStatus update_biome(
        const domain::Biome &biome) override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::Biome>>
    find_biome_by_id(
        const domain::BiomeId &id) const override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::Biome>>
    find_biome_by_slug(
        const std::string &slug) const override;

    [[nodiscard]] RepositoryResult<
        std::vector<domain::Biome>>
    list_biomes() const override;

    RepositoryStatus create_natural_area(
        const domain::NaturalArea &area) override;

    RepositoryStatus update_natural_area(
        const domain::NaturalArea &area) override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::NaturalArea>>
    find_natural_area_by_id(
        const domain::NaturalAreaId &id) const override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::NaturalArea>>
    find_natural_area_by_region(
        const world::domain::RegionId &region_id) const override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::NaturalArea>>
    find_natural_area_by_place(
        const world::domain::PlaceId &place_id) const override;

    [[nodiscard]] RepositoryResult<
        std::vector<domain::NaturalArea>>
    list_natural_areas_by_biome(
        const domain::BiomeId &biome_id) const override;

    RepositoryStatus save_environment_state(
        const domain::EnvironmentState &state) override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::EnvironmentState>>
    find_environment_state(
        const domain::NaturalAreaId &natural_area_id) const override;

  private:
    /**
     * @brief Create the nature-owned database tables.
     *
     * @return Schema initialization status.
     */
    [[nodiscard]] RepositoryStatus ensure_schema();

    vix::db::Database *database_ = nullptr;
    RepositoryStatus schema_status_;
  };
} // namespace orelunza::nature::repositories

#endif // ORELUNZA_NATURE_REPOSITORIES_DB_NATURE_REPOSITORY_HPP_INCLUDED
