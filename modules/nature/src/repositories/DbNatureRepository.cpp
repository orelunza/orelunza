/**
 *
 * @file DbNatureRepository.cpp
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

#include <nature/repositories/DbNatureRepository.hpp>

#include <cstdint>
#include <exception>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace
{
  namespace domain = orelunza::nature::domain;
  namespace errors = orelunza::nature::errors;
  namespace repositories = orelunza::nature::repositories;
  namespace world_domain = orelunza::world::domain;

  [[nodiscard]] std::string escape_sql(
      std::string_view value)
  {
    std::string escaped;
    escaped.reserve(value.size());

    for (const char character : value)
    {
      if (character == '\'')
      {
        escaped += "''";
      }
      else
      {
        escaped += character;
      }
    }

    return escaped;
  }

  [[nodiscard]] std::string quote_sql(
      std::string_view value)
  {
    return "'" + escape_sql(value) + "'";
  }

  [[nodiscard]] std::string bool_sql(bool value)
  {
    return value ? "1" : "0";
  }

  [[nodiscard]] repositories::RepositoryStatus
  storage_failure(
      std::string_view operation,
      const std::exception &exception)
  {
    return repositories::RepositoryStatus::failure(
        errors::make_nature_error(
            errors::NatureErrorCode::StorageError,
            std::string{operation} +
                ": " +
                exception.what()));
  }

  template <typename T>
  [[nodiscard]] repositories::RepositoryResult<T>
  storage_result_failure(
      std::string_view operation,
      const std::exception &exception)
  {
    return repositories::RepositoryResult<T>::failure(
        errors::make_nature_error(
            errors::NatureErrorCode::StorageError,
            std::string{operation} +
                ": " +
                exception.what()));
  }

  template <typename Row>
  [[nodiscard]] domain::Biome biome_from_row(
      Row &row)
  {
    return domain::Biome{
        domain::BiomeId{
            row.getString(0)},
        row.getString(1),
        row.getString(2),
        row.getString(3),
        row.getString(4),
        row.getString(5),
        row.getInt64(6) != 0,
        row.getInt64(7),
        row.getInt64(8)};
  }

  template <typename Row>
  [[nodiscard]] domain::NaturalArea area_from_row(
      Row &row)
  {
    std::optional<world_domain::PlaceId> place_id;

    auto place_value = row.getString(3);

    if (!place_value.empty())
    {
      place_id = world_domain::PlaceId{
          std::move(place_value)};
    }

    return domain::NaturalArea{
        domain::NaturalAreaId{
            row.getString(0)},
        domain::BiomeId{
            row.getString(1)},
        world_domain::RegionId{
            row.getString(2)},
        std::move(place_id),
        row.getString(4),
        row.getString(5),
        row.getInt64(6) != 0,
        row.getInt64(7),
        row.getInt64(8)};
  }

  template <typename Row>
  [[nodiscard]] domain::EnvironmentState
  environment_state_from_row(Row &row)
  {
    return domain::EnvironmentState{
        domain::NaturalAreaId{
            row.getString(0)},
        row.getString(1),
        row.getString(2),
        row.getString(3),
        static_cast<std::int32_t>(
            row.getInt64(4)),
        static_cast<std::int32_t>(
            row.getInt64(5)),
        row.getInt64(6)};
  }
} // namespace

namespace orelunza::nature::repositories
{
  DbNatureRepository::DbNatureRepository(
      vix::db::Database &database)
      : database_(&database),
        schema_status_(RepositoryStatus::success())
  {
    schema_status_ = ensure_schema();
  }

  bool DbNatureRepository::ready() const noexcept
  {
    return database_ != nullptr &&
           schema_status_.ok();
  }

  const RepositoryStatus &
  DbNatureRepository::schema_status() const noexcept
  {
    return schema_status_;
  }

  RepositoryStatus DbNatureRepository::ensure_schema()
  {
    if (database_ == nullptr)
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::ConfigurationError,
              "Nature repository database is not configured."));
    }

    try
    {
      database_->exec(
          "CREATE TABLE IF NOT EXISTS nature_biomes ("
          "id VARCHAR(128) NOT NULL PRIMARY KEY,"
          "name VARCHAR(255) NOT NULL,"
          "slug VARCHAR(255) NOT NULL UNIQUE,"
          "description TEXT NOT NULL,"
          "terrain_type VARCHAR(128) NOT NULL,"
          "vegetation_type VARCHAR(128) NOT NULL,"
          "enabled INTEGER NOT NULL DEFAULT 1,"
          "created_at BIGINT NOT NULL,"
          "updated_at BIGINT NOT NULL"
          ");");

      database_->exec(
          "CREATE TABLE IF NOT EXISTS nature_areas ("
          "id VARCHAR(128) NOT NULL PRIMARY KEY,"
          "biome_id VARCHAR(128) NOT NULL,"
          "region_id VARCHAR(128) NOT NULL,"
          "place_id VARCHAR(128),"
          "name VARCHAR(255) NOT NULL,"
          "description TEXT NOT NULL,"
          "enabled INTEGER NOT NULL DEFAULT 1,"
          "created_at BIGINT NOT NULL,"
          "updated_at BIGINT NOT NULL,"
          "FOREIGN KEY (biome_id) "
          "REFERENCES nature_biomes(id)"
          ");");

      database_->exec(
          "CREATE TABLE IF NOT EXISTS "
          "nature_environment_states ("
          "natural_area_id VARCHAR(128) NOT NULL PRIMARY KEY,"
          "terrain_condition VARCHAR(128) NOT NULL,"
          "vegetation_condition VARCHAR(128) NOT NULL,"
          "ambient_description TEXT NOT NULL,"
          "vegetation_density INTEGER NOT NULL,"
          "water_level INTEGER NOT NULL,"
          "updated_at BIGINT NOT NULL,"
          "FOREIGN KEY (natural_area_id) "
          "REFERENCES nature_areas(id)"
          ");");

      database_->exec(
          "CREATE INDEX IF NOT EXISTS "
          "idx_nature_areas_biome_id "
          "ON nature_areas(biome_id);");

      database_->exec(
          "CREATE INDEX IF NOT EXISTS "
          "idx_nature_areas_region_id "
          "ON nature_areas(region_id);");

      database_->exec(
          "CREATE INDEX IF NOT EXISTS "
          "idx_nature_areas_place_id "
          "ON nature_areas(place_id);");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to initialize the nature schema",
          exception);
    }
  }

  RepositoryStatus DbNatureRepository::create_biome(
      const domain::Biome &biome)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!biome.valid())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "Cannot persist an invalid biome."));
    }

    auto existing_id =
        find_biome_by_id(biome.id());

    if (existing_id.failed())
    {
      return RepositoryStatus::failure(
          existing_id.error());
    }

    if (existing_id.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "A biome already exists with this identifier."));
    }

    auto existing_slug =
        find_biome_by_slug(biome.slug());

    if (existing_slug.failed())
    {
      return RepositoryStatus::failure(
          existing_slug.error());
    }

    if (existing_slug.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "A biome already exists with this slug."));
    }

    try
    {
      database_->exec(
          "INSERT INTO nature_biomes ("
          "id, name, slug, description, "
          "terrain_type, vegetation_type, enabled, "
          "created_at, updated_at"
          ") VALUES (" +
          quote_sql(biome.id().value()) + ", " +
          quote_sql(biome.name()) + ", " +
          quote_sql(biome.slug()) + ", " +
          quote_sql(biome.description()) + ", " +
          quote_sql(biome.terrain_type()) + ", " +
          quote_sql(biome.vegetation_type()) + ", " +
          bool_sql(biome.enabled()) + ", " +
          std::to_string(biome.created_at()) + ", " +
          std::to_string(biome.updated_at()) +
          ");");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to create the biome",
          exception);
    }
  }

  RepositoryStatus DbNatureRepository::update_biome(
      const domain::Biome &biome)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!biome.valid())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "Cannot update an invalid biome."));
    }

    auto existing =
        find_biome_by_id(biome.id());

    if (existing.failed())
    {
      return RepositoryStatus::failure(
          existing.error());
    }

    if (!existing.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::BiomeNotFound,
              "The biome was not found."));
    }

    auto slug_owner =
        find_biome_by_slug(biome.slug());

    if (slug_owner.failed())
    {
      return RepositoryStatus::failure(
          slug_owner.error());
    }

    if (slug_owner.value().has_value() &&
        slug_owner.value()->id() != biome.id())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "Another biome already uses this slug."));
    }

    try
    {
      database_->exec(
          "UPDATE nature_biomes SET "
          "name = " +
          quote_sql(biome.name()) +
          ", slug = " +
          quote_sql(biome.slug()) +
          ", description = " +
          quote_sql(biome.description()) +
          ", terrain_type = " +
          quote_sql(biome.terrain_type()) +
          ", vegetation_type = " +
          quote_sql(biome.vegetation_type()) +
          ", enabled = " +
          bool_sql(biome.enabled()) +
          ", updated_at = " +
          std::to_string(biome.updated_at()) +
          " WHERE id = " +
          quote_sql(biome.id().value()) +
          ";");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to update the biome",
          exception);
    }
  }

  RepositoryResult<std::optional<domain::Biome>>
  DbNatureRepository::find_biome_by_id(
      const domain::BiomeId &id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::Biome>>::failure(schema_status_.error());
    }

    if (!id.valid())
    {
      return RepositoryResult<
          std::optional<domain::Biome>>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidBiomeId,
                                                                           "A valid biome identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, name, slug, description, "
          "terrain_type, vegetation_type, enabled, "
          "created_at, updated_at "
          "FROM nature_biomes "
          "WHERE id = " +
          quote_sql(id.value()) +
          " LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::Biome>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::Biome>>::success(biome_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::Biome>>(
          "Unable to find the biome",
          exception);
    }
  }

  RepositoryResult<std::optional<domain::Biome>>
  DbNatureRepository::find_biome_by_slug(
      const std::string &slug) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::Biome>>::failure(schema_status_.error());
    }

    if (slug.empty())
    {
      return RepositoryResult<
          std::optional<domain::Biome>>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidInput,
                                                                           "A biome slug is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, name, slug, description, "
          "terrain_type, vegetation_type, enabled, "
          "created_at, updated_at "
          "FROM nature_biomes "
          "WHERE slug = " +
          quote_sql(slug) +
          " LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::Biome>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::Biome>>::success(biome_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::Biome>>(
          "Unable to find the biome by slug",
          exception);
    }
  }

  RepositoryResult<std::vector<domain::Biome>>
  DbNatureRepository::list_biomes() const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::vector<domain::Biome>>::failure(schema_status_.error());
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, name, slug, description, "
          "terrain_type, vegetation_type, enabled, "
          "created_at, updated_at "
          "FROM nature_biomes "
          "ORDER BY created_at ASC, id ASC;");

      std::vector<domain::Biome> biomes;

      while (result->next())
      {
        auto &row = result->row();
        biomes.push_back(biome_from_row(row));
      }

      return RepositoryResult<
          std::vector<domain::Biome>>::success(std::move(biomes));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::vector<domain::Biome>>(
          "Unable to list biomes",
          exception);
    }
  }

  RepositoryStatus
  DbNatureRepository::create_natural_area(
      const domain::NaturalArea &area)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!area.valid())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "Cannot persist an invalid natural area."));
    }

    auto existing_id =
        find_natural_area_by_id(area.id());

    if (existing_id.failed())
    {
      return RepositoryStatus::failure(
          existing_id.error());
    }

    if (existing_id.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "A natural area already exists "
              "with this identifier."));
    }

    auto biome =
        find_biome_by_id(area.biome_id());

    if (biome.failed())
    {
      return RepositoryStatus::failure(
          biome.error());
    }

    if (!biome.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::BiomeNotFound,
              "The natural area biome was not found."));
    }

    if (area.has_place())
    {
      auto existing_place =
          find_natural_area_by_place(
              area.place_id().value());

      if (existing_place.failed())
      {
        return RepositoryStatus::failure(
            existing_place.error());
      }

      if (existing_place.value().has_value())
      {
        return RepositoryStatus::failure(
            errors::make_nature_error(
                errors::NatureErrorCode::InvalidInput,
                "A natural area already exists "
                "for this place."));
      }
    }
    else
    {
      auto existing_region =
          find_natural_area_by_region(
              area.region_id());

      if (existing_region.failed())
      {
        return RepositoryStatus::failure(
            existing_region.error());
      }

      if (existing_region.value().has_value())
      {
        return RepositoryStatus::failure(
            errors::make_nature_error(
                errors::NatureErrorCode::InvalidInput,
                "A region-wide natural area already "
                "exists for this region."));
      }
    }

    const auto place_sql =
        area.has_place()
            ? quote_sql(area.place_id()->value())
            : std::string{"NULL"};

    try
    {
      database_->exec(
          "INSERT INTO nature_areas ("
          "id, biome_id, region_id, place_id, "
          "name, description, enabled, "
          "created_at, updated_at"
          ") VALUES (" +
          quote_sql(area.id().value()) + ", " +
          quote_sql(area.biome_id().value()) + ", " +
          quote_sql(area.region_id().value()) + ", " +
          place_sql + ", " +
          quote_sql(area.name()) + ", " +
          quote_sql(area.description()) + ", " +
          bool_sql(area.enabled()) + ", " +
          std::to_string(area.created_at()) + ", " +
          std::to_string(area.updated_at()) +
          ");");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to create the natural area",
          exception);
    }
  }

  RepositoryStatus
  DbNatureRepository::update_natural_area(
      const domain::NaturalArea &area)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!area.valid())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "Cannot update an invalid natural area."));
    }

    auto existing =
        find_natural_area_by_id(area.id());

    if (existing.failed())
    {
      return RepositoryStatus::failure(
          existing.error());
    }

    if (!existing.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::NaturalAreaNotFound,
              "The natural area was not found."));
    }

    auto biome =
        find_biome_by_id(area.biome_id());

    if (biome.failed())
    {
      return RepositoryStatus::failure(
          biome.error());
    }

    if (!biome.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::BiomeNotFound,
              "The natural area biome was not found."));
    }

    if (area.has_place())
    {
      auto place_owner =
          find_natural_area_by_place(
              area.place_id().value());

      if (place_owner.failed())
      {
        return RepositoryStatus::failure(
            place_owner.error());
      }

      if (place_owner.value().has_value() &&
          place_owner.value()->id() != area.id())
      {
        return RepositoryStatus::failure(
            errors::make_nature_error(
                errors::NatureErrorCode::InvalidInput,
                "Another natural area already "
                "uses this place."));
      }
    }
    else
    {
      auto region_owner =
          find_natural_area_by_region(
              area.region_id());

      if (region_owner.failed())
      {
        return RepositoryStatus::failure(
            region_owner.error());
      }

      if (region_owner.value().has_value() &&
          region_owner.value()->id() != area.id())
      {
        return RepositoryStatus::failure(
            errors::make_nature_error(
                errors::NatureErrorCode::InvalidInput,
                "Another region-wide natural area "
                "already uses this region."));
      }
    }

    const auto place_sql =
        area.has_place()
            ? quote_sql(area.place_id()->value())
            : std::string{"NULL"};

    try
    {
      database_->exec(
          "UPDATE nature_areas SET "
          "biome_id = " +
          quote_sql(area.biome_id().value()) +
          ", region_id = " +
          quote_sql(area.region_id().value()) +
          ", place_id = " +
          place_sql +
          ", name = " +
          quote_sql(area.name()) +
          ", description = " +
          quote_sql(area.description()) +
          ", enabled = " +
          bool_sql(area.enabled()) +
          ", updated_at = " +
          std::to_string(area.updated_at()) +
          " WHERE id = " +
          quote_sql(area.id().value()) +
          ";");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to update the natural area",
          exception);
    }
  }

  RepositoryResult<
      std::optional<domain::NaturalArea>>
  DbNatureRepository::find_natural_area_by_id(
      const domain::NaturalAreaId &id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::NaturalArea>>::failure(schema_status_.error());
    }

    if (!id.valid())
    {
      return RepositoryResult<
          std::optional<domain::NaturalArea>>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidNaturalAreaId,
                                                                                 "A valid natural area identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, biome_id, region_id, place_id, "
          "name, description, enabled, "
          "created_at, updated_at "
          "FROM nature_areas "
          "WHERE id = " +
          quote_sql(id.value()) +
          " LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::NaturalArea>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::NaturalArea>>::success(area_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::NaturalArea>>(
          "Unable to find the natural area",
          exception);
    }
  }

  RepositoryResult<
      std::optional<domain::NaturalArea>>
  DbNatureRepository::find_natural_area_by_region(
      const world::domain::RegionId &region_id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::NaturalArea>>::failure(schema_status_.error());
    }

    if (!region_id.valid())
    {
      return RepositoryResult<
          std::optional<domain::NaturalArea>>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidRegionId,
                                                                                 "A valid region identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, biome_id, region_id, place_id, "
          "name, description, enabled, "
          "created_at, updated_at "
          "FROM nature_areas "
          "WHERE region_id = " +
          quote_sql(region_id.value()) +
          " AND place_id IS NULL "
          "LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::NaturalArea>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::NaturalArea>>::success(area_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::NaturalArea>>(
          "Unable to find the region natural area",
          exception);
    }
  }

  RepositoryResult<
      std::optional<domain::NaturalArea>>
  DbNatureRepository::find_natural_area_by_place(
      const world::domain::PlaceId &place_id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::NaturalArea>>::failure(schema_status_.error());
    }

    if (!place_id.valid())
    {
      return RepositoryResult<
          std::optional<domain::NaturalArea>>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidPlaceId,
                                                                                 "A valid place identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, biome_id, region_id, place_id, "
          "name, description, enabled, "
          "created_at, updated_at "
          "FROM nature_areas "
          "WHERE place_id = " +
          quote_sql(place_id.value()) +
          " LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::NaturalArea>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::NaturalArea>>::success(area_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::NaturalArea>>(
          "Unable to find the place natural area",
          exception);
    }
  }

  RepositoryResult<
      std::vector<domain::NaturalArea>>
  DbNatureRepository::list_natural_areas_by_biome(
      const domain::BiomeId &biome_id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::vector<domain::NaturalArea>>::failure(schema_status_.error());
    }

    if (!biome_id.valid())
    {
      return RepositoryResult<
          std::vector<domain::NaturalArea>>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidBiomeId,
                                                                               "A valid biome identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, biome_id, region_id, place_id, "
          "name, description, enabled, "
          "created_at, updated_at "
          "FROM nature_areas "
          "WHERE biome_id = " +
          quote_sql(biome_id.value()) +
          " ORDER BY created_at ASC, id ASC;");

      std::vector<domain::NaturalArea> areas;

      while (result->next())
      {
        auto &row = result->row();
        areas.push_back(area_from_row(row));
      }

      return RepositoryResult<
          std::vector<domain::NaturalArea>>::success(std::move(areas));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::vector<domain::NaturalArea>>(
          "Unable to list biome natural areas",
          exception);
    }
  }

  RepositoryStatus
  DbNatureRepository::save_environment_state(
      const domain::EnvironmentState &state)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!state.valid())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "Cannot persist an invalid environment state."));
    }

    auto area =
        find_natural_area_by_id(
            state.natural_area_id());

    if (area.failed())
    {
      return RepositoryStatus::failure(
          area.error());
    }

    if (!area.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::NaturalAreaNotFound,
              "The environment state's natural area "
              "was not found."));
    }

    try
    {
      database_->exec(
          "INSERT INTO nature_environment_states ("
          "natural_area_id, terrain_condition, "
          "vegetation_condition, ambient_description, "
          "vegetation_density, water_level, updated_at"
          ") VALUES (" +
          quote_sql(state.natural_area_id().value()) + ", " +
          quote_sql(state.terrain_condition()) + ", " +
          quote_sql(state.vegetation_condition()) + ", " +
          quote_sql(state.ambient_description()) + ", " +
          std::to_string(state.vegetation_density()) + ", " +
          std::to_string(state.water_level()) + ", " +
          std::to_string(state.updated_at()) +
          ") ON CONFLICT(natural_area_id) DO UPDATE SET "
          "terrain_condition = excluded.terrain_condition, "
          "vegetation_condition = "
          "excluded.vegetation_condition, "
          "ambient_description = "
          "excluded.ambient_description, "
          "vegetation_density = "
          "excluded.vegetation_density, "
          "water_level = excluded.water_level, "
          "updated_at = excluded.updated_at;");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to save the environment state",
          exception);
    }
  }

  RepositoryResult<
      std::optional<domain::EnvironmentState>>
  DbNatureRepository::find_environment_state(
      const domain::NaturalAreaId &natural_area_id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::EnvironmentState>>::failure(schema_status_.error());
    }

    if (!natural_area_id.valid())
    {
      return RepositoryResult<
          std::optional<domain::EnvironmentState>>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidNaturalAreaId,
                                                                                      "A valid natural area identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "natural_area_id, terrain_condition, "
          "vegetation_condition, ambient_description, "
          "vegetation_density, water_level, updated_at "
          "FROM nature_environment_states "
          "WHERE natural_area_id = " +
          quote_sql(natural_area_id.value()) +
          " LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::EnvironmentState>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::EnvironmentState>>::success(environment_state_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::EnvironmentState>>(
          "Unable to find the environment state",
          exception);
    }
  }
} // namespace orelunza::nature::repositories
