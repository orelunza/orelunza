/**
 *
 * @file test_world_repository.cpp
 * @author Softadastra
 * @brief Tests for the database-backed Orelunza world repository.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <world/domain/HumanPosition.hpp>
#include <world/domain/Place.hpp>
#include <world/domain/Region.hpp>
#include <world/errors/WorldError.hpp>
#include <world/repositories/DbWorldRepository.hpp>

#include <vix/db.hpp>
#include <vix/tests/tests.hpp>

#include <chrono>
#include <cstdint>
#include <filesystem>
#include <optional>
#include <string>
#include <system_error>
#include <utility>

namespace
{
  namespace identity_domain =
      orelunza::identity::domain;

  namespace world_domain =
      orelunza::world::domain;

  namespace world_errors =
      orelunza::world::errors;

  namespace world_repositories =
      orelunza::world::repositories;

  class TemporaryDatabasePath
  {
  public:
    TemporaryDatabasePath()
        : path_(
              std::filesystem::temp_directory_path() /
              ("orelunza-world-" +
               std::to_string(
                   std::chrono::steady_clock::now()
                       .time_since_epoch()
                       .count()) +
               ".sqlite"))
    {
    }

    ~TemporaryDatabasePath()
    {
      std::error_code error;

      std::filesystem::remove(path_, error);
      std::filesystem::remove(
          path_.string() + "-wal",
          error);
      std::filesystem::remove(
          path_.string() + "-shm",
          error);
    }

    [[nodiscard]] const std::filesystem::path &
    value() const noexcept
    {
      return path_;
    }

  private:
    std::filesystem::path path_;
  };

  class RepositoryFixture
  {
  public:
    RepositoryFixture()
        : database(
              vix::db::Database::sqlite(
                  database_path.value().string())),
          repository(database)
    {
    }

    TemporaryDatabasePath database_path;
    vix::db::Database database;
    world_repositories::DbWorldRepository repository;
  };

  [[nodiscard]] world_domain::Region make_region(
      std::string id = "region_forest",
      std::string slug = "forest",
      bool enabled = true)
  {
    return world_domain::Region{
        world_domain::RegionId{std::move(id)},
        "Silent Forest",
        std::move(slug),
        "A quiet forest at the edge of Orelunza.",
        enabled,
        100,
        100};
  }

  [[nodiscard]] world_domain::Place make_place(
      std::string id = "place_river",
      std::string region_id = "region_forest",
      bool enabled = true)
  {
    return world_domain::Place{
        world_domain::PlaceId{std::move(id)},
        world_domain::RegionId{std::move(region_id)},
        "Quiet River",
        "A peaceful river inside the forest.",
        "river",
        24,
        48,
        enabled,
        100,
        100};
  }

  [[nodiscard]] world_domain::HumanPosition
  make_position(
      std::int64_t position_x = 24,
      std::int64_t position_y = 48)
  {
    return world_domain::HumanPosition{
        identity_domain::HumanId{
            std::string{"human_001"}},
        world_domain::RegionId{
            std::string{"region_forest"}},
        world_domain::PlaceId{
            std::string{"place_river"}},
        position_x,
        position_y,
        200};
  }
} // namespace

int main()
{
  using namespace vix::tests;

  auto &registry = TestRegistry::instance();
  registry.clear();

  registry.add(TestCase(
      "world repository initializes its schema",
      []
      {
        RepositoryFixture fixture;

        Assert::is_true(
            fixture.repository.ready());

        Assert::is_true(
            fixture.repository.schema_status().ok());
      }));

  registry.add(TestCase(
      "world repository creates and finds a region",
      []
      {
        RepositoryFixture fixture;

        const auto region = make_region();

        auto create_status =
            fixture.repository.create_region(region);

        Assert::is_true(create_status.ok());

        auto found =
            fixture.repository.find_region_by_id(
                region.id());

        Assert::is_true(found.ok());
        Assert::is_true(found.value().has_value());

        Assert::equal(
            std::string{"region_forest"},
            found.value()->id().value());

        Assert::equal(
            std::string{"Silent Forest"},
            found.value()->name());

        Assert::equal(
            std::string{"forest"},
            found.value()->slug());

        Assert::is_true(found.value()->enabled());
      }));

  registry.add(TestCase(
      "world repository finds a region by slug",
      []
      {
        RepositoryFixture fixture;

        Assert::is_true(
            fixture.repository
                .create_region(make_region())
                .ok());

        auto found =
            fixture.repository.find_region_by_slug(
                "forest");

        Assert::is_true(found.ok());
        Assert::is_true(found.value().has_value());

        Assert::equal(
            std::string{"region_forest"},
            found.value()->id().value());
      }));

  registry.add(TestCase(
      "world repository rejects duplicate regions",
      []
      {
        RepositoryFixture fixture;

        const auto region = make_region();

        Assert::is_true(
            fixture.repository
                .create_region(region)
                .ok());

        auto duplicate =
            fixture.repository.create_region(region);

        Assert::is_true(duplicate.failed());

        Assert::is_true(
            duplicate.error().is(
                world_errors::WorldErrorCode::
                    InvalidInput));
      }));

  registry.add(TestCase(
      "world repository rejects duplicate region slugs",
      []
      {
        RepositoryFixture fixture;

        Assert::is_true(
            fixture.repository
                .create_region(make_region())
                .ok());

        auto duplicate =
            fixture.repository.create_region(
                make_region(
                    "region_second",
                    "forest"));

        Assert::is_true(duplicate.failed());

        Assert::is_true(
            duplicate.error().is(
                world_errors::WorldErrorCode::
                    InvalidInput));
      }));

  registry.add(TestCase(
      "world repository updates a region",
      []
      {
        RepositoryFixture fixture;

        auto region = make_region();

        Assert::is_true(
            fixture.repository
                .create_region(region)
                .ok());

        region.set_name("Deep Forest");
        region.set_description(
            "A deeper and quieter forest.");
        region.set_enabled(false);
        region.set_updated_at(200);

        auto update_status =
            fixture.repository.update_region(region);

        Assert::is_true(update_status.ok());

        auto found =
            fixture.repository.find_region_by_id(
                region.id());

        Assert::is_true(found.ok());
        Assert::is_true(found.value().has_value());

        Assert::equal(
            std::string{"Deep Forest"},
            found.value()->name());

        Assert::is_true(found.value()->disabled());

        Assert::equal(
            std::int64_t{200},
            found.value()->updated_at());
      }));

  registry.add(TestCase(
      "world repository lists regions",
      []
      {
        RepositoryFixture fixture;

        Assert::is_true(
            fixture.repository
                .create_region(
                    make_region(
                        "region_forest",
                        "forest"))
                .ok());

        Assert::is_true(
            fixture.repository
                .create_region(
                    make_region(
                        "region_valley",
                        "valley"))
                .ok());

        auto regions =
            fixture.repository.list_regions();

        Assert::is_true(regions.ok());

        Assert::equal(
            std::size_t{2},
            regions.value().size());
      }));

  registry.add(TestCase(
      "world repository creates and finds a place",
      []
      {
        RepositoryFixture fixture;

        Assert::is_true(
            fixture.repository
                .create_region(make_region())
                .ok());

        const auto place = make_place();

        auto create_status =
            fixture.repository.create_place(place);

        Assert::is_true(create_status.ok());

        auto found =
            fixture.repository.find_place_by_id(
                place.id());

        Assert::is_true(found.ok());
        Assert::is_true(found.value().has_value());

        Assert::equal(
            std::string{"place_river"},
            found.value()->id().value());

        Assert::equal(
            std::string{"region_forest"},
            found.value()->region_id().value());

        Assert::equal(
            std::string{"river"},
            found.value()->type());

        Assert::equal(
            std::int64_t{24},
            found.value()->position_x());

        Assert::equal(
            std::int64_t{48},
            found.value()->position_y());
      }));

  registry.add(TestCase(
      "world repository rejects a place with unknown region",
      []
      {
        RepositoryFixture fixture;

        auto status =
            fixture.repository.create_place(
                make_place(
                    "place_unknown",
                    "region_unknown"));

        Assert::is_true(status.failed());

        Assert::is_true(
            status.error().is(
                world_errors::WorldErrorCode::
                    RegionNotFound));
      }));

  registry.add(TestCase(
      "world repository updates a place",
      []
      {
        RepositoryFixture fixture;

        Assert::is_true(
            fixture.repository
                .create_region(make_region())
                .ok());

        auto place = make_place();

        Assert::is_true(
            fixture.repository
                .create_place(place)
                .ok());

        place.set_name("Moon River");
        place.set_description(
            "A river visible beneath the moon.");
        place.set_type("water");
        place.set_position(64, 96);
        place.set_enabled(false);
        place.set_updated_at(300);

        auto update_status =
            fixture.repository.update_place(place);

        Assert::is_true(update_status.ok());

        auto found =
            fixture.repository.find_place_by_id(
                place.id());

        Assert::is_true(found.ok());
        Assert::is_true(found.value().has_value());

        Assert::equal(
            std::string{"Moon River"},
            found.value()->name());

        Assert::equal(
            std::string{"water"},
            found.value()->type());

        Assert::equal(
            std::int64_t{64},
            found.value()->position_x());

        Assert::equal(
            std::int64_t{96},
            found.value()->position_y());

        Assert::is_true(found.value()->disabled());
      }));

  registry.add(TestCase(
      "world repository lists places by region",
      []
      {
        RepositoryFixture fixture;

        Assert::is_true(
            fixture.repository
                .create_region(make_region())
                .ok());

        Assert::is_true(
            fixture.repository
                .create_place(
                    make_place(
                        "place_river",
                        "region_forest"))
                .ok());

        Assert::is_true(
            fixture.repository
                .create_place(
                    make_place(
                        "place_library",
                        "region_forest"))
                .ok());

        auto places =
            fixture.repository.list_places_by_region(
                world_domain::RegionId{
                    std::string{"region_forest"}});

        Assert::is_true(places.ok());

        Assert::equal(
            std::size_t{2},
            places.value().size());
      }));

  registry.add(TestCase(
      "world repository saves and finds human position",
      []
      {
        RepositoryFixture fixture;

        Assert::is_true(
            fixture.repository
                .create_region(make_region())
                .ok());

        Assert::is_true(
            fixture.repository
                .create_place(make_place())
                .ok());

        const auto position = make_position();

        auto save_status =
            fixture.repository.save_human_position(
                position);

        Assert::is_true(save_status.ok());

        auto found =
            fixture.repository.find_human_position(
                position.human_id());

        Assert::is_true(found.ok());
        Assert::is_true(found.value().has_value());

        Assert::equal(
            std::string{"human_001"},
            found.value()->human_id().value());

        Assert::equal(
            std::string{"region_forest"},
            found.value()->region_id().value());

        Assert::is_true(
            found.value()->has_place());

        Assert::equal(
            std::string{"place_river"},
            found.value()
                ->place_id()
                .value()
                .value());

        Assert::equal(
            std::int64_t{24},
            found.value()->position_x());
      }));

  registry.add(TestCase(
      "world repository updates existing human position",
      []
      {
        RepositoryFixture fixture;

        Assert::is_true(
            fixture.repository
                .create_region(make_region())
                .ok());

        Assert::is_true(
            fixture.repository
                .create_place(make_place())
                .ok());

        Assert::is_true(
            fixture.repository
                .save_human_position(
                    make_position())
                .ok());

        auto updated_position =
            make_position(80, 120);

        updated_position.set_updated_at(400);

        Assert::is_true(
            fixture.repository
                .save_human_position(
                    updated_position)
                .ok());

        auto found =
            fixture.repository.find_human_position(
                updated_position.human_id());

        Assert::is_true(found.ok());
        Assert::is_true(found.value().has_value());

        Assert::equal(
            std::int64_t{80},
            found.value()->position_x());

        Assert::equal(
            std::int64_t{120},
            found.value()->position_y());

        Assert::equal(
            std::int64_t{400},
            found.value()->updated_at());
      }));

  registry.add(TestCase(
      "world repository returns empty values for unknown records",
      []
      {
        RepositoryFixture fixture;

        auto region =
            fixture.repository.find_region_by_id(
                world_domain::RegionId{
                    std::string{"region_unknown"}});

        auto place =
            fixture.repository.find_place_by_id(
                world_domain::PlaceId{
                    std::string{"place_unknown"}});

        auto position =
            fixture.repository.find_human_position(
                identity_domain::HumanId{
                    std::string{"human_unknown"}});

        Assert::is_true(region.ok());
        Assert::is_false(
            region.value().has_value());

        Assert::is_true(place.ok());
        Assert::is_false(
            place.value().has_value());

        Assert::is_true(position.ok());
        Assert::is_false(
            position.value().has_value());
      }));

  return TestRunner::run_all_and_exit();
}
