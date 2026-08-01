/**
 *
 * @file test_world_service.cpp
 * @author Softadastra
 * @brief Tests for the Orelunza world application service.
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
#include <world/repositories/WorldRepository.hpp>
#include <world/services/WorldService.hpp>

#include <vix/tests/tests.hpp>

#include <algorithm>
#include <optional>
#include <string>
#include <utility>
#include <vector>

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

  namespace world_services =
      orelunza::world::services;

  [[nodiscard]] world_domain::Region make_region(
      std::string id = "region_forest",
      std::string slug = "forest",
      bool enabled = true)
  {
    return world_domain::Region{
        world_domain::RegionId{std::move(id)},
        "Silent Forest",
        std::move(slug),
        "A quiet forest.",
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
        "A peaceful river.",
        "river",
        24,
        48,
        enabled,
        100,
        100};
  }

  class FakeWorldRepository final
      : public world_repositories::WorldRepository
  {
  public:
    world_repositories::RepositoryStatus
    create_region(
        const world_domain::Region &region) override
    {
      regions.push_back(region);

      return world_repositories::RepositoryStatus::
          success();
    }

    world_repositories::RepositoryStatus
    update_region(
        const world_domain::Region &region) override
    {
      for (auto &stored : regions)
      {
        if (stored.id() == region.id())
        {
          stored = region;

          return world_repositories::
              RepositoryStatus::success();
        }
      }

      return world_repositories::RepositoryStatus::
          failure(
              world_errors::make_world_error(
                  world_errors::WorldErrorCode::
                      RegionNotFound,
                  "Region was not found."));
    }

    world_repositories::RepositoryResult<
        std::optional<world_domain::Region>>
    find_region_by_id(
        const world_domain::RegionId &id) const override
    {
      if (find_region_error.has_error())
      {
        return world_repositories::RepositoryResult<
            std::optional<world_domain::Region>>::failure(find_region_error);
      }

      for (const auto &region : regions)
      {
        if (region.id() == id)
        {
          return world_repositories::RepositoryResult<
              std::optional<world_domain::Region>>::success(region);
        }
      }

      return world_repositories::RepositoryResult<
          std::optional<world_domain::Region>>::success(std::nullopt);
    }

    world_repositories::RepositoryResult<
        std::optional<world_domain::Region>>
    find_region_by_slug(
        const std::string &slug) const override
    {
      for (const auto &region : regions)
      {
        if (region.slug() == slug)
        {
          return world_repositories::RepositoryResult<
              std::optional<world_domain::Region>>::success(region);
        }
      }

      return world_repositories::RepositoryResult<
          std::optional<world_domain::Region>>::success(std::nullopt);
    }

    world_repositories::RepositoryResult<
        std::vector<world_domain::Region>>
    list_regions() const override
    {
      if (list_regions_error.has_error())
      {
        return world_repositories::RepositoryResult<
            std::vector<world_domain::Region>>::failure(list_regions_error);
      }

      return world_repositories::RepositoryResult<
          std::vector<world_domain::Region>>::success(regions);
    }

    world_repositories::RepositoryStatus
    create_place(
        const world_domain::Place &place) override
    {
      places.push_back(place);

      return world_repositories::RepositoryStatus::
          success();
    }

    world_repositories::RepositoryStatus
    update_place(
        const world_domain::Place &place) override
    {
      for (auto &stored : places)
      {
        if (stored.id() == place.id())
        {
          stored = place;

          return world_repositories::
              RepositoryStatus::success();
        }
      }

      return world_repositories::RepositoryStatus::
          failure(
              world_errors::make_world_error(
                  world_errors::WorldErrorCode::
                      PlaceNotFound,
                  "Place was not found."));
    }

    world_repositories::RepositoryResult<
        std::optional<world_domain::Place>>
    find_place_by_id(
        const world_domain::PlaceId &id) const override
    {
      if (find_place_error.has_error())
      {
        return world_repositories::RepositoryResult<
            std::optional<world_domain::Place>>::failure(find_place_error);
      }

      for (const auto &place : places)
      {
        if (place.id() == id)
        {
          return world_repositories::RepositoryResult<
              std::optional<world_domain::Place>>::success(place);
        }
      }

      return world_repositories::RepositoryResult<
          std::optional<world_domain::Place>>::success(std::nullopt);
    }

    world_repositories::RepositoryResult<
        std::vector<world_domain::Place>>
    list_places_by_region(
        const world_domain::RegionId &region_id) const override
    {
      if (list_places_error.has_error())
      {
        return world_repositories::RepositoryResult<
            std::vector<world_domain::Place>>::failure(list_places_error);
      }

      std::vector<world_domain::Place> matches;

      for (const auto &place : places)
      {
        if (place.region_id() == region_id)
        {
          matches.push_back(place);
        }
      }

      return world_repositories::RepositoryResult<
          std::vector<world_domain::Place>>::success(std::move(matches));
    }

    world_repositories::RepositoryStatus
    save_human_position(
        const world_domain::HumanPosition &position) override
    {
      if (save_position_error.has_error())
      {
        return world_repositories::RepositoryStatus::
            failure(save_position_error);
      }

      stored_position = position;

      return world_repositories::RepositoryStatus::
          success();
    }

    world_repositories::RepositoryResult<
        std::optional<world_domain::HumanPosition>>
    find_human_position(
        const identity_domain::HumanId &human_id) const override
    {
      if (find_position_error.has_error())
      {
        return world_repositories::RepositoryResult<
            std::optional<
                world_domain::HumanPosition>>::failure(find_position_error);
      }

      if (stored_position.has_value() &&
          stored_position->human_id() == human_id)
      {
        return world_repositories::RepositoryResult<
            std::optional<
                world_domain::HumanPosition>>::success(stored_position);
      }

      return world_repositories::RepositoryResult<
          std::optional<
              world_domain::HumanPosition>>::success(std::nullopt);
    }

    std::vector<world_domain::Region> regions;
    std::vector<world_domain::Place> places;

    std::optional<world_domain::HumanPosition>
        stored_position;

    world_errors::WorldError find_region_error;
    world_errors::WorldError list_regions_error;
    world_errors::WorldError find_place_error;
    world_errors::WorldError list_places_error;
    world_errors::WorldError save_position_error;
    world_errors::WorldError find_position_error;
  };
} // namespace

int main()
{
  using namespace vix::tests;

  auto &registry = TestRegistry::instance();
  registry.clear();

  registry.add(TestCase(
      "world service returns enabled regions",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region(
                "region_forest",
                "forest",
                true));

        repository.regions.push_back(
            make_region(
                "region_closed",
                "closed",
                false));

        world_services::WorldService service{
            repository};

        auto result = service.list_regions();

        Assert::is_true(result.ok());

        Assert::equal(
            std::size_t{1},
            result.value().size());

        Assert::equal(
            std::string{"region_forest"},
            result.value().front().id().value());
      }));

  registry.add(TestCase(
      "world service returns the world overview",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region());

        world_services::WorldService service{
            repository};

        auto result = service.get_world();

        Assert::is_true(result.ok());

        Assert::equal(
            std::string{"orelunza"},
            result.value().id.value());

        Assert::equal(
            std::size_t{1},
            result.value().regions.size());
      }));

  registry.add(TestCase(
      "world service returns an enabled region",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region());

        world_services::WorldService service{
            repository};

        auto result = service.get_region(
            world_domain::RegionId{
                std::string{"region_forest"}});

        Assert::is_true(result.ok());

        Assert::equal(
            std::string{"Silent Forest"},
            result.value().name());
      }));

  registry.add(TestCase(
      "world service reports an unknown region",
      []
      {
        FakeWorldRepository repository;

        world_services::WorldService service{
            repository};

        auto result = service.get_region(
            world_domain::RegionId{
                std::string{"region_unknown"}});

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                world_errors::WorldErrorCode::
                    RegionNotFound));
      }));

  registry.add(TestCase(
      "world service rejects a disabled region",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region(
                "region_closed",
                "closed",
                false));

        world_services::WorldService service{
            repository};

        auto result = service.get_region(
            world_domain::RegionId{
                std::string{"region_closed"}});

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                world_errors::WorldErrorCode::
                    RegionDisabled));
      }));

  registry.add(TestCase(
      "world service lists enabled places",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region());

        repository.places.push_back(
            make_place(
                "place_river",
                "region_forest",
                true));

        repository.places.push_back(
            make_place(
                "place_closed",
                "region_forest",
                false));

        world_services::WorldService service{
            repository};

        auto result = service.list_places(
            world_domain::RegionId{
                std::string{"region_forest"}});

        Assert::is_true(result.ok());

        Assert::equal(
            std::size_t{1},
            result.value().size());

        Assert::equal(
            std::string{"place_river"},
            result.value().front().id().value());
      }));

  registry.add(TestCase(
      "world service returns an enabled place",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region());

        repository.places.push_back(
            make_place());

        world_services::WorldService service{
            repository};

        auto result = service.get_place(
            world_domain::PlaceId{
                std::string{"place_river"}});

        Assert::is_true(result.ok());

        Assert::equal(
            std::string{"Quiet River"},
            result.value().name());
      }));

  registry.add(TestCase(
      "world service rejects a disabled place",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region());

        repository.places.push_back(
            make_place(
                "place_closed",
                "region_forest",
                false));

        world_services::WorldService service{
            repository};

        auto result = service.get_place(
            world_domain::PlaceId{
                std::string{"place_closed"}});

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                world_errors::WorldErrorCode::
                    PlaceDisabled));
      }));

  registry.add(TestCase(
      "world service moves a human to a place",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region());

        repository.places.push_back(
            make_place());

        world_services::WorldService service{
            repository};

        world_services::MoveHumanRequest request{
            identity_domain::HumanId{
                std::string{"human_001"}},
            world_domain::RegionId{
                std::string{"region_forest"}},
            world_domain::PlaceId{
                std::string{"place_river"}},
            80,
            120};

        auto result = service.move_human(request);

        Assert::is_true(result.ok());

        Assert::equal(
            std::string{"human_001"},
            result.value().human_id().value());

        Assert::equal(
            std::string{"region_forest"},
            result.value().region_id().value());

        Assert::is_true(
            result.value().has_place());

        Assert::equal(
            std::string{"place_river"},
            result.value()
                .place_id()
                .value()
                .value());

        Assert::equal(
            std::int64_t{80},
            result.value().position_x());

        Assert::equal(
            std::int64_t{120},
            result.value().position_y());

        Assert::is_true(
            repository.stored_position.has_value());
      }));

  registry.add(TestCase(
      "world service moves a human without a named place",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region());

        world_services::WorldService service{
            repository};

        world_services::MoveHumanRequest request{
            identity_domain::HumanId{
                std::string{"human_001"}},
            world_domain::RegionId{
                std::string{"region_forest"}},
            std::nullopt,
            10,
            15};

        auto result = service.move_human(request);

        Assert::is_true(result.ok());
        Assert::is_false(
            result.value().has_place());
      }));

  registry.add(TestCase(
      "world service rejects a place from another region",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region(
                "region_forest",
                "forest"));

        repository.regions.push_back(
            make_region(
                "region_valley",
                "valley"));

        repository.places.push_back(
            make_place(
                "place_river",
                "region_valley"));

        world_services::WorldService service{
            repository};

        world_services::MoveHumanRequest request{
            identity_domain::HumanId{
                std::string{"human_001"}},
            world_domain::RegionId{
                std::string{"region_forest"}},
            world_domain::PlaceId{
                std::string{"place_river"}},
            10,
            20};

        auto result = service.move_human(request);

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                world_errors::WorldErrorCode::
                    InvalidInput));
      }));

  registry.add(TestCase(
      "world service returns a stored human position",
      []
      {
        FakeWorldRepository repository;

        repository.regions.push_back(
            make_region());

        repository.places.push_back(
            make_place());

        repository.stored_position =
            world_domain::HumanPosition{
                identity_domain::HumanId{
                    std::string{"human_001"}},
                world_domain::RegionId{
                    std::string{"region_forest"}},
                world_domain::PlaceId{
                    std::string{"place_river"}},
                24,
                48,
                200};

        world_services::WorldService service{
            repository};

        auto result =
            service.get_human_position(
                identity_domain::HumanId{
                    std::string{"human_001"}});

        Assert::is_true(result.ok());

        Assert::equal(
            std::int64_t{24},
            result.value().position_x());

        Assert::equal(
            std::int64_t{48},
            result.value().position_y());
      }));

  registry.add(TestCase(
      "world service reports a missing human position",
      []
      {
        FakeWorldRepository repository;

        world_services::WorldService service{
            repository};

        auto result =
            service.get_human_position(
                identity_domain::HumanId{
                    std::string{"human_001"}});

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                world_errors::WorldErrorCode::
                    PositionNotFound));
      }));

  registry.add(TestCase(
      "world service propagates repository failures",
      []
      {
        FakeWorldRepository repository;

        repository.list_regions_error =
            world_errors::make_world_error(
                world_errors::WorldErrorCode::
                    StorageError,
                "Database is unavailable.");

        world_services::WorldService service{
            repository};

        auto result = service.list_regions();

        Assert::is_true(result.failed());

        Assert::is_true(
            result.error().is(
                world_errors::WorldErrorCode::
                    StorageError));
      }));

  return TestRunner::run_all_and_exit();
}
