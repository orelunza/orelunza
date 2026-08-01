/**
 *
 * @file DbWorldRepository.cpp
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

#include <world/repositories/DbWorldRepository.hpp>

#include <exception>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace
{
  namespace domain = orelunza::world::domain;
  namespace errors = orelunza::world::errors;
  namespace repositories = orelunza::world::repositories;

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
        continue;
      }

      escaped += character;
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
        errors::make_world_error(
            errors::WorldErrorCode::StorageError,
            std::string(operation) + ": " + exception.what()));
  }

  template <typename T>
  [[nodiscard]] repositories::RepositoryResult<T>
  storage_result_failure(
      std::string_view operation,
      const std::exception &exception)
  {
    return repositories::RepositoryResult<T>::failure(
        errors::make_world_error(
            errors::WorldErrorCode::StorageError,
            std::string(operation) + ": " + exception.what()));
  }

  template <typename Row>
  [[nodiscard]] domain::Region region_from_row(Row &row)
  {
    return domain::Region{
        domain::RegionId{row.getString(0)},
        row.getString(1),
        row.getString(2),
        row.getString(3),
        row.getInt64(4) != 0,
        row.getInt64(5),
        row.getInt64(6)};
  }

  template <typename Row>
  [[nodiscard]] domain::Place place_from_row(Row &row)
  {
    return domain::Place{
        domain::PlaceId{row.getString(0)},
        domain::RegionId{row.getString(1)},
        row.getString(2),
        row.getString(3),
        row.getString(4),
        row.getInt64(5),
        row.getInt64(6),
        row.getInt64(7) != 0,
        row.getInt64(8),
        row.getInt64(9)};
  }

  template <typename Row>
  [[nodiscard]] domain::HumanPosition position_from_row(
      Row &row)
  {
    std::optional<domain::PlaceId> place_id;
    auto place_value = row.getString(2);

    if (!place_value.empty())
    {
      place_id = domain::PlaceId{
          std::move(place_value)};
    }

    return domain::HumanPosition{
        orelunza::identity::domain::HumanId{
            row.getString(0)},
        domain::RegionId{
            row.getString(1)},
        std::move(place_id),
        row.getInt64(3),
        row.getInt64(4),
        row.getInt64(5)};
  }
} // namespace

namespace orelunza::world::repositories
{
  DbWorldRepository::DbWorldRepository(
      vix::db::Database &database)
      : database_(&database),
        schema_status_(RepositoryStatus::success())
  {
    schema_status_ = ensure_schema();
  }

  bool DbWorldRepository::ready() const noexcept
  {
    return database_ != nullptr &&
           schema_status_.ok();
  }

  const RepositoryStatus &
  DbWorldRepository::schema_status() const noexcept
  {
    return schema_status_;
  }

  RepositoryStatus DbWorldRepository::ensure_schema()
  {
    if (database_ == nullptr)
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::ConfigurationError,
              "World repository database is not configured."));
    }

    try
    {
      database_->exec(
          "CREATE TABLE IF NOT EXISTS world_regions ("
          "id VARCHAR(128) NOT NULL PRIMARY KEY,"
          "name VARCHAR(255) NOT NULL,"
          "slug VARCHAR(255) NOT NULL UNIQUE,"
          "description TEXT NOT NULL,"
          "enabled INTEGER NOT NULL DEFAULT 1,"
          "created_at BIGINT NOT NULL,"
          "updated_at BIGINT NOT NULL"
          ");");

      database_->exec(
          "CREATE TABLE IF NOT EXISTS world_places ("
          "id VARCHAR(128) NOT NULL PRIMARY KEY,"
          "region_id VARCHAR(128) NOT NULL,"
          "name VARCHAR(255) NOT NULL,"
          "description TEXT NOT NULL,"
          "type VARCHAR(64) NOT NULL,"
          "position_x BIGINT NOT NULL,"
          "position_y BIGINT NOT NULL,"
          "enabled INTEGER NOT NULL DEFAULT 1,"
          "created_at BIGINT NOT NULL,"
          "updated_at BIGINT NOT NULL,"
          "FOREIGN KEY (region_id) "
          "REFERENCES world_regions(id)"
          ");");

      database_->exec(
          "CREATE TABLE IF NOT EXISTS "
          "world_human_positions ("
          "human_id VARCHAR(128) NOT NULL PRIMARY KEY,"
          "region_id VARCHAR(128) NOT NULL,"
          "place_id VARCHAR(128),"
          "position_x BIGINT NOT NULL,"
          "position_y BIGINT NOT NULL,"
          "updated_at BIGINT NOT NULL,"
          "FOREIGN KEY (region_id) "
          "REFERENCES world_regions(id),"
          "FOREIGN KEY (place_id) "
          "REFERENCES world_places(id)"
          ");");

      database_->exec(
          "CREATE INDEX IF NOT EXISTS "
          "idx_world_places_region_id "
          "ON world_places(region_id);");

      database_->exec(
          "CREATE INDEX IF NOT EXISTS "
          "idx_world_positions_region_id "
          "ON world_human_positions(region_id);");

      database_->exec(
          "CREATE INDEX IF NOT EXISTS "
          "idx_world_positions_place_id "
          "ON world_human_positions(place_id);");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to initialize the world schema",
          exception);
    }
  }

  RepositoryStatus DbWorldRepository::create_region(
      const domain::Region &region)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!region.valid())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidInput,
              "Cannot persist an invalid world region."));
    }

    auto existing_id = find_region_by_id(region.id());

    if (existing_id.failed())
    {
      return RepositoryStatus::failure(
          existing_id.error());
    }

    if (existing_id.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidInput,
              "A region already exists with this identifier."));
    }

    auto existing_slug =
        find_region_by_slug(region.slug());

    if (existing_slug.failed())
    {
      return RepositoryStatus::failure(
          existing_slug.error());
    }

    if (existing_slug.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidInput,
              "A region already exists with this slug."));
    }

    try
    {
      database_->exec(
          "INSERT INTO world_regions ("
          "id, name, slug, description, enabled, "
          "created_at, updated_at"
          ") VALUES (" +
          quote_sql(region.id().value()) + ", " +
          quote_sql(region.name()) + ", " +
          quote_sql(region.slug()) + ", " +
          quote_sql(region.description()) + ", " +
          bool_sql(region.enabled()) + ", " +
          std::to_string(region.created_at()) + ", " +
          std::to_string(region.updated_at()) +
          ");");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to create the world region",
          exception);
    }
  }

  RepositoryStatus DbWorldRepository::update_region(
      const domain::Region &region)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!region.valid())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidInput,
              "Cannot update an invalid world region."));
    }

    auto existing = find_region_by_id(region.id());

    if (existing.failed())
    {
      return RepositoryStatus::failure(
          existing.error());
    }

    if (!existing.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::RegionNotFound,
              "The world region was not found."));
    }

    auto slug_owner =
        find_region_by_slug(region.slug());

    if (slug_owner.failed())
    {
      return RepositoryStatus::failure(
          slug_owner.error());
    }

    if (slug_owner.value().has_value() &&
        slug_owner.value()->id() != region.id())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidInput,
              "Another region already uses this slug."));
    }

    try
    {
      database_->exec(
          "UPDATE world_regions SET "
          "name = " +
          quote_sql(region.name()) +
          ", slug = " +
          quote_sql(region.slug()) +
          ", description = " +
          quote_sql(region.description()) +
          ", enabled = " +
          bool_sql(region.enabled()) +
          ", updated_at = " +
          std::to_string(region.updated_at()) +
          " WHERE id = " +
          quote_sql(region.id().value()) +
          ";");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to update the world region",
          exception);
    }
  }

  RepositoryResult<std::optional<domain::Region>>
  DbWorldRepository::find_region_by_id(
      const domain::RegionId &id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::Region>>::failure(schema_status_.error());
    }

    if (!id.valid())
    {
      return RepositoryResult<
          std::optional<domain::Region>>::failure(errors::make_world_error(errors::WorldErrorCode::InvalidRegionId,
                                                                           "A valid region identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, name, slug, description, enabled, "
          "created_at, updated_at "
          "FROM world_regions "
          "WHERE id = " +
          quote_sql(id.value()) +
          " LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::Region>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::Region>>::success(region_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::Region>>(
          "Unable to find the world region",
          exception);
    }
  }

  RepositoryResult<std::optional<domain::Region>>
  DbWorldRepository::find_region_by_slug(
      const std::string &slug) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::Region>>::failure(schema_status_.error());
    }

    if (slug.empty())
    {
      return RepositoryResult<
          std::optional<domain::Region>>::failure(errors::make_world_error(errors::WorldErrorCode::InvalidInput,
                                                                           "A region slug is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, name, slug, description, enabled, "
          "created_at, updated_at "
          "FROM world_regions "
          "WHERE slug = " +
          quote_sql(slug) +
          " LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::Region>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::Region>>::success(region_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::Region>>(
          "Unable to find the region by slug",
          exception);
    }
  }

  RepositoryResult<std::vector<domain::Region>>
  DbWorldRepository::list_regions() const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::vector<domain::Region>>::failure(schema_status_.error());
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, name, slug, description, enabled, "
          "created_at, updated_at "
          "FROM world_regions "
          "ORDER BY created_at ASC, id ASC;");

      std::vector<domain::Region> regions;

      while (result->next())
      {
        auto &row = result->row();
        regions.push_back(region_from_row(row));
      }

      return RepositoryResult<
          std::vector<domain::Region>>::success(std::move(regions));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::vector<domain::Region>>(
          "Unable to list world regions",
          exception);
    }
  }

  RepositoryStatus DbWorldRepository::create_place(
      const domain::Place &place)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!place.valid())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidInput,
              "Cannot persist an invalid world place."));
    }

    auto existing = find_place_by_id(place.id());

    if (existing.failed())
    {
      return RepositoryStatus::failure(
          existing.error());
    }

    if (existing.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidInput,
              "A place already exists with this identifier."));
    }

    auto region = find_region_by_id(place.region_id());

    if (region.failed())
    {
      return RepositoryStatus::failure(
          region.error());
    }

    if (!region.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::RegionNotFound,
              "The place region was not found."));
    }

    try
    {
      database_->exec(
          "INSERT INTO world_places ("
          "id, region_id, name, description, type, "
          "position_x, position_y, enabled, "
          "created_at, updated_at"
          ") VALUES (" +
          quote_sql(place.id().value()) + ", " +
          quote_sql(place.region_id().value()) + ", " +
          quote_sql(place.name()) + ", " +
          quote_sql(place.description()) + ", " +
          quote_sql(place.type()) + ", " +
          std::to_string(place.position_x()) + ", " +
          std::to_string(place.position_y()) + ", " +
          bool_sql(place.enabled()) + ", " +
          std::to_string(place.created_at()) + ", " +
          std::to_string(place.updated_at()) +
          ");");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to create the world place",
          exception);
    }
  }

  RepositoryStatus DbWorldRepository::update_place(
      const domain::Place &place)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!place.valid())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidInput,
              "Cannot update an invalid world place."));
    }

    auto existing = find_place_by_id(place.id());

    if (existing.failed())
    {
      return RepositoryStatus::failure(
          existing.error());
    }

    if (!existing.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::PlaceNotFound,
              "The world place was not found."));
    }

    auto region = find_region_by_id(place.region_id());

    if (region.failed())
    {
      return RepositoryStatus::failure(
          region.error());
    }

    if (!region.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::RegionNotFound,
              "The place region was not found."));
    }

    try
    {
      database_->exec(
          "UPDATE world_places SET "
          "region_id = " +
          quote_sql(place.region_id().value()) +
          ", name = " +
          quote_sql(place.name()) +
          ", description = " +
          quote_sql(place.description()) +
          ", type = " +
          quote_sql(place.type()) +
          ", position_x = " +
          std::to_string(place.position_x()) +
          ", position_y = " +
          std::to_string(place.position_y()) +
          ", enabled = " +
          bool_sql(place.enabled()) +
          ", updated_at = " +
          std::to_string(place.updated_at()) +
          " WHERE id = " +
          quote_sql(place.id().value()) +
          ";");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to update the world place",
          exception);
    }
  }

  RepositoryResult<std::optional<domain::Place>>
  DbWorldRepository::find_place_by_id(
      const domain::PlaceId &id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::Place>>::failure(schema_status_.error());
    }

    if (!id.valid())
    {
      return RepositoryResult<
          std::optional<domain::Place>>::failure(errors::make_world_error(errors::WorldErrorCode::InvalidPlaceId,
                                                                          "A valid place identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, region_id, name, description, type, "
          "position_x, position_y, enabled, "
          "created_at, updated_at "
          "FROM world_places "
          "WHERE id = " +
          quote_sql(id.value()) +
          " LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::Place>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::Place>>::success(place_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::Place>>(
          "Unable to find the world place",
          exception);
    }
  }

  RepositoryResult<std::vector<domain::Place>>
  DbWorldRepository::list_places_by_region(
      const domain::RegionId &region_id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::vector<domain::Place>>::failure(schema_status_.error());
    }

    if (!region_id.valid())
    {
      return RepositoryResult<
          std::vector<domain::Place>>::failure(errors::make_world_error(errors::WorldErrorCode::InvalidRegionId,
                                                                        "A valid region identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "id, region_id, name, description, type, "
          "position_x, position_y, enabled, "
          "created_at, updated_at "
          "FROM world_places "
          "WHERE region_id = " +
          quote_sql(region_id.value()) +
          " ORDER BY created_at ASC, id ASC;");

      std::vector<domain::Place> places;

      while (result->next())
      {
        auto &row = result->row();
        places.push_back(place_from_row(row));
      }

      return RepositoryResult<
          std::vector<domain::Place>>::success(std::move(places));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::vector<domain::Place>>(
          "Unable to list region places",
          exception);
    }
  }

  RepositoryStatus
  DbWorldRepository::save_human_position(
      const domain::HumanPosition &position)
  {
    if (!ready())
    {
      return RepositoryStatus::failure(
          schema_status_.error());
    }

    if (!position.valid())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidInput,
              "Cannot persist an invalid human position."));
    }

    auto region =
        find_region_by_id(position.region_id());

    if (region.failed())
    {
      return RepositoryStatus::failure(
          region.error());
    }

    if (!region.value().has_value())
    {
      return RepositoryStatus::failure(
          errors::make_world_error(
              errors::WorldErrorCode::RegionNotFound,
              "The human position region was not found."));
    }

    if (position.has_place())
    {
      auto place =
          find_place_by_id(position.place_id().value());

      if (place.failed())
      {
        return RepositoryStatus::failure(
            place.error());
      }

      if (!place.value().has_value())
      {
        return RepositoryStatus::failure(
            errors::make_world_error(
                errors::WorldErrorCode::PlaceNotFound,
                "The human position place was not found."));
      }

      if (!place.value()->belongs_to(
              position.region_id()))
      {
        return RepositoryStatus::failure(
            errors::make_world_error(
                errors::WorldErrorCode::InvalidInput,
                "The selected place does not belong "
                "to the selected region."));
      }
    }

    const auto place_sql =
        position.has_place()
            ? quote_sql(position.place_id()->value())
            : std::string{"NULL"};

    try
    {
      database_->exec(
          "INSERT INTO world_human_positions ("
          "human_id, region_id, place_id, "
          "position_x, position_y, updated_at"
          ") VALUES (" +
          quote_sql(position.human_id().value()) + ", " +
          quote_sql(position.region_id().value()) + ", " +
          place_sql + ", " +
          std::to_string(position.position_x()) + ", " +
          std::to_string(position.position_y()) + ", " +
          std::to_string(position.updated_at()) +
          ") ON CONFLICT(human_id) DO UPDATE SET "
          "region_id = excluded.region_id, "
          "place_id = excluded.place_id, "
          "position_x = excluded.position_x, "
          "position_y = excluded.position_y, "
          "updated_at = excluded.updated_at;");

      return RepositoryStatus::success();
    }
    catch (const std::exception &exception)
    {
      return storage_failure(
          "Unable to save the human position",
          exception);
    }
  }

  RepositoryResult<std::optional<domain::HumanPosition>>
  DbWorldRepository::find_human_position(
      const identity::domain::HumanId &human_id) const
  {
    if (!ready())
    {
      return RepositoryResult<
          std::optional<domain::HumanPosition>>::failure(schema_status_.error());
    }

    if (!human_id.valid())
    {
      return RepositoryResult<
          std::optional<domain::HumanPosition>>::failure(errors::make_world_error(errors::WorldErrorCode::InvalidInput,
                                                                                  "A valid human identifier is required."));
    }

    try
    {
      auto result = database_->query(
          "SELECT "
          "human_id, region_id, place_id, "
          "position_x, position_y, updated_at "
          "FROM world_human_positions "
          "WHERE human_id = " +
          quote_sql(human_id.value()) +
          " LIMIT 1;");

      if (!result->next())
      {
        return RepositoryResult<
            std::optional<domain::HumanPosition>>::success(std::nullopt);
      }

      auto &row = result->row();

      return RepositoryResult<
          std::optional<domain::HumanPosition>>::success(position_from_row(row));
    }
    catch (const std::exception &exception)
    {
      return storage_result_failure<
          std::optional<domain::HumanPosition>>(
          "Unable to find the human position",
          exception);
    }
  }
} // namespace orelunza::world::repositories
