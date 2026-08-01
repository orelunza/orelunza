/**
 *
 * @file DbWorldRepository.hpp
 * @author Softadastra
 * @brief Database-backed repository for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_REPOSITORIES_DB_WORLD_REPOSITORY_HPP_INCLUDED
#define ORELUNZA_WORLD_REPOSITORIES_DB_WORLD_REPOSITORY_HPP_INCLUDED

#include <world/repositories/WorldRepository.hpp>

#include <vix/db.hpp>
#include <vix/db/Database.hpp>

namespace orelunza::world::repositories
{
  /**
   * @brief Stores world state using a Vix database connection.
   */
  class DbWorldRepository final : public WorldRepository
  {
  public:
    /**
     * @brief Construct the repository and initialize its schema.
     *
     * @param database Shared application database.
     */
    explicit DbWorldRepository(vix::db::Database &database);

    /**
     * @brief Return whether the repository is ready.
     *
     * @return true when the database and schema are available.
     */
    [[nodiscard]] bool ready() const noexcept;

    /**
     * @brief Return the schema initialization status.
     *
     * @return Schema status.
     */
    [[nodiscard]] const RepositoryStatus &
    schema_status() const noexcept;

    RepositoryStatus create_region(
        const domain::Region &region) override;

    RepositoryStatus update_region(
        const domain::Region &region) override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::Region>>
    find_region_by_id(
        const domain::RegionId &id) const override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::Region>>
    find_region_by_slug(
        const std::string &slug) const override;

    [[nodiscard]] RepositoryResult<
        std::vector<domain::Region>>
    list_regions() const override;

    RepositoryStatus create_place(
        const domain::Place &place) override;

    RepositoryStatus update_place(
        const domain::Place &place) override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::Place>>
    find_place_by_id(
        const domain::PlaceId &id) const override;

    [[nodiscard]] RepositoryResult<
        std::vector<domain::Place>>
    list_places_by_region(
        const domain::RegionId &region_id) const override;

    RepositoryStatus save_human_position(
        const domain::HumanPosition &position) override;

    [[nodiscard]] RepositoryResult<
        std::optional<domain::HumanPosition>>
    find_human_position(
        const identity::domain::HumanId &human_id) const override;

  private:
    /**
     * @brief Create the world-owned database tables.
     *
     * @return Schema initialization status.
     */
    [[nodiscard]] RepositoryStatus ensure_schema();

    vix::db::Database *database_ = nullptr;
    RepositoryStatus schema_status_;
  };
} // namespace orelunza::world::repositories

#endif // ORELUNZA_WORLD_REPOSITORIES_DB_WORLD_REPOSITORY_HPP_INCLUDED
