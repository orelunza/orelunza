/**
 *
 * @file test_nature_service.cpp
 * @author Softadastra
 * @brief Service tests for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <nature/domain/NatureIds.hpp>
#include <nature/errors/NatureError.hpp>
#include <nature/repositories/DbNatureRepository.hpp>
#include <nature/services/NatureService.hpp>

#include <world/domain/Place.hpp>
#include <world/domain/Region.hpp>
#include <world/domain/WorldIds.hpp>
#include <world/repositories/DbWorldRepository.hpp>
#include <world/services/WorldService.hpp>

#include <vix/db/Database.hpp>

#include <cstdint>
#include <exception>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>

namespace
{
  using orelunza::nature::domain::BiomeId;
  using orelunza::nature::domain::NaturalAreaId;
  using orelunza::nature::errors::NatureErrorCode;
  using orelunza::nature::repositories::DbNatureRepository;
  using orelunza::nature::services::CreateBiomeRequest;
  using orelunza::nature::services::CreateNaturalAreaRequest;
  using orelunza::nature::services::NatureService;
  using orelunza::nature::services::UpdateEnvironmentStateRequest;

  using orelunza::world::domain::Place;
  using orelunza::world::domain::PlaceId;
  using orelunza::world::domain::Region;
  using orelunza::world::domain::RegionId;
  using orelunza::world::repositories::DbWorldRepository;
  using orelunza::world::services::WorldService;

  void require(
      bool condition,
      const std::string &message)
  {
    if (!condition)
    {
      throw std::runtime_error(message);
    }
  }

  void seed_world(
      DbWorldRepository &repository)
  {
    const Region forest_region{
        RegionId{"region_forest"},
        "Silent Forest",
        "silent-forest",
        "A quiet forest at the edge of Orelunza.",
        true,
        100,
        100};

    const Region mountain_region{
        RegionId{"region_mountain"},
        "Northern Mountain",
        "northern-mountain",
        "A high mountain region.",
        true,
        101,
        101};

    const Place river_place{
        PlaceId{"place_river"},
        RegionId{"region_forest"},
        "Quiet River",
        "A peaceful river inside the forest.",
        "river",
        24,
        48,
        true,
        110,
        110};

    auto forest_status =
        repository.create_region(forest_region);

    require(
        forest_status.ok(),
        "Forest region creation must succeed.");

    auto mountain_status =
        repository.create_region(mountain_region);

    require(
        mountain_status.ok(),
        "Mountain region creation must succeed.");

    auto river_status =
        repository.create_place(river_place);

    require(
        river_status.ok(),
        "River place creation must succeed.");
  }

  BiomeId create_forest_biome(
      NatureService &service)
  {
    auto result =
        service.create_biome(
            CreateBiomeRequest{
                "Forest",
                "forest",
                "A dense and peaceful forest biome.",
                "woodland",
                "trees",
                true});

    require(
        result.ok(),
        "Forest biome creation must succeed.");

    require(
        result.value().id().valid(),
        "Created biome must have an identifier.");

    return result.value().id();
  }

  NaturalAreaId create_region_area(
      NatureService &service,
      const BiomeId &biome_id)
  {
    CreateNaturalAreaRequest request;
    request.biome_id = biome_id;
    request.region_id =
        RegionId{"region_forest"};
    request.name = "Silent Forest";
    request.description =
        "The natural environment of the forest region.";
    request.enabled = true;

    auto result =
        service.create_natural_area(request);

    require(
        result.ok(),
        "Region natural area creation must succeed.");

    require(
        result.value().region_wide(),
        "Created region area must be region-wide.");

    return result.value().id();
  }

  NaturalAreaId create_place_area(
      NatureService &service,
      const BiomeId &biome_id)
  {
    CreateNaturalAreaRequest request;
    request.biome_id = biome_id;
    request.region_id =
        RegionId{"region_forest"};
    request.place_id =
        PlaceId{"place_river"};
    request.name = "Quiet River";
    request.description =
        "A peaceful river surrounded by forest.";
    request.enabled = true;

    auto result =
        service.create_natural_area(request);

    require(
        result.ok(),
        "Place natural area creation must succeed.");

    require(
        result.value().has_place(),
        "Created place area must contain a place.");

    return result.value().id();
  }

  void test_empty_nature(
      NatureService &service)
  {
    auto overview =
        service.get_nature();

    require(
        overview.ok(),
        "Empty nature overview must succeed.");

    require(
        overview.value().biomes.empty(),
        "Empty nature overview must contain no biomes.");

    auto biomes =
        service.list_biomes();

    require(
        biomes.ok(),
        "Empty biome listing must succeed.");

    require(
        biomes.value().empty(),
        "Empty biome listing must contain no values.");
  }

  void test_biome_operations(
      NatureService &service,
      const BiomeId &forest_biome_id)
  {
    auto biome =
        service.get_biome(forest_biome_id);

    require(
        biome.ok(),
        "Created biome must be readable.");

    require(
        biome.value().slug() == "forest",
        "Created biome slug must match.");

    auto list_result =
        service.list_biomes();

    require(
        list_result.ok(),
        "Biome listing must succeed.");

    require(
        list_result.value().size() == 1,
        "Enabled biome listing must contain the forest.");

    auto duplicate =
        service.create_biome(
            CreateBiomeRequest{
                "Second Forest",
                "forest",
                "A biome using an existing slug.",
                "woodland",
                "trees",
                true});

    require(
        duplicate.failed(),
        "Duplicate biome slug must be rejected.");

    require(
        duplicate.error().is(
            NatureErrorCode::InvalidInput),
        "Duplicate biome slug must return invalid_input.");

    auto invalid =
        service.create_biome(
            CreateBiomeRequest{});

    require(
        invalid.failed(),
        "Invalid biome request must be rejected.");

    require(
        invalid.error().is(
            NatureErrorCode::InvalidInput),
        "Invalid biome request must return invalid_input.");

    auto missing =
        service.get_biome(
            BiomeId{"biome_missing"});

    require(
        missing.failed(),
        "Missing biome must fail.");

    require(
        missing.error().is(
            NatureErrorCode::BiomeNotFound),
        "Missing biome must return biome_not_found.");
  }

  void test_region_and_place_nature(
      NatureService &service,
      const BiomeId &biome_id,
      const NaturalAreaId &region_area_id,
      const NaturalAreaId &place_area_id)
  {
    auto region_nature =
        service.get_region_nature(
            RegionId{"region_forest"});

    require(
        region_nature.ok(),
        "Region nature lookup must succeed.");

    require(
        region_nature.value().id() ==
            region_area_id,
        "Region nature lookup must return the region area.");

    auto place_nature =
        service.get_place_nature(
            PlaceId{"place_river"});

    require(
        place_nature.ok(),
        "Place nature lookup must succeed.");

    require(
        place_nature.value().id() ==
            place_area_id,
        "Place nature lookup must return the place area.");

    auto by_id =
        service.get_natural_area(place_area_id);

    require(
        by_id.ok(),
        "Natural area lookup by identifier must succeed.");

    require(
        by_id.value().belongs_to_place(
            PlaceId{"place_river"}),
        "Natural area must belong to the expected place.");

    auto biome_areas =
        service.list_biome_areas(biome_id);

    require(
        biome_areas.ok(),
        "Biome area listing must succeed.");

    require(
        biome_areas.value().size() == 2,
        "Biome must contain the region and place areas.");

    auto missing_region =
        service.get_region_nature(
            RegionId{"region_unknown"});

    require(
        missing_region.failed(),
        "Unknown region must fail.");

    require(
        missing_region.error().is(
            NatureErrorCode::RegionNotFound),
        "Unknown region must return region_not_found.");

    auto missing_place =
        service.get_place_nature(
            PlaceId{"place_unknown"});

    require(
        missing_place.failed(),
        "Unknown place must fail.");

    require(
        missing_place.error().is(
            NatureErrorCode::PlaceNotFound),
        "Unknown place must return place_not_found.");
  }

  void test_place_region_validation(
      NatureService &service,
      const BiomeId &biome_id)
  {
    CreateNaturalAreaRequest request;
    request.biome_id = biome_id;
    request.region_id =
        RegionId{"region_mountain"};
    request.place_id =
        PlaceId{"place_river"};
    request.name = "Invalid River Area";
    request.description =
        "The river does not belong to the mountain.";
    request.enabled = true;

    auto result =
        service.create_natural_area(request);

    require(
        result.failed(),
        "A place attached to the wrong region must fail.");

    require(
        result.error().is(
            NatureErrorCode::InvalidInput),
        "Wrong place-region relation must return invalid_input.");
  }

  void test_environment_state(
      NatureService &service,
      const NaturalAreaId &place_area_id)
  {
    auto missing =
        service.get_environment_state(
            place_area_id);

    require(
        missing.failed(),
        "Missing environment state must fail.");

    require(
        missing.error().is(
            NatureErrorCode::EnvironmentStateNotFound),
        "Missing state must return environment_state_not_found.");

    UpdateEnvironmentStateRequest request;
    request.natural_area_id = place_area_id;
    request.terrain_condition = "soft_ground";
    request.vegetation_condition = "healthy";
    request.ambient_description =
        "The river flows quietly under the trees.";
    request.vegetation_density = 85;
    request.water_level = 70;

    auto update_result =
        service.update_environment_state(request);

    require(
        update_result.ok(),
        "Environment state update must succeed.");

    require(
        update_result.value().vegetation_density() == 85,
        "Updated vegetation density must match.");

    require(
        update_result.value().water_level() == 70,
        "Updated water level must match.");

    auto read_result =
        service.get_environment_state(
            place_area_id);

    require(
        read_result.ok(),
        "Persisted environment state must be readable.");

    require(
        read_result.value().terrain_condition() ==
            "soft_ground",
        "Persisted terrain condition must match.");

    request.water_level = 101;

    auto invalid_level =
        service.update_environment_state(request);

    require(
        invalid_level.failed(),
        "Water level above 100 must be rejected.");

    require(
        invalid_level.error().is(
            NatureErrorCode::InvalidInput),
        "Invalid water level must return invalid_input.");
  }

  void test_disabled_biome(
      DbNatureRepository &repository,
      NatureService &service)
  {
    const auto timestamp =
        static_cast<std::int64_t>(200);

    const orelunza::nature::domain::Biome disabled{
        BiomeId{"biome_desert"},
        "Desert",
        "desert",
        "A disabled desert biome.",
        "sand",
        "sparse",
        false,
        timestamp,
        timestamp};

    auto create_status =
        repository.create_biome(disabled);

    require(
        create_status.ok(),
        "Disabled biome persistence must succeed.");

    auto direct =
        service.get_biome(
            BiomeId{"biome_desert"});

    require(
        direct.failed(),
        "Disabled biome must not be publicly readable.");

    require(
        direct.error().is(
            NatureErrorCode::BiomeDisabled),
        "Disabled biome must return biome_disabled.");

    auto list_result =
        service.list_biomes();

    require(
        list_result.ok(),
        "Biome listing with disabled values must succeed.");

    require(
        list_result.value().size() == 1,
        "Disabled biome must be excluded from listing.");
  }
} // namespace

int main()
{
  try
  {
    auto database =
        vix::db::Database::sqlite(":memory:");

    DbWorldRepository world_repository{database};

    require(
        world_repository.ready(),
        "World repository must initialize.");

    seed_world(world_repository);

    WorldService world_service{
        world_repository};

    DbNatureRepository nature_repository{
        database};

    require(
        nature_repository.ready(),
        "Nature repository must initialize.");

    NatureService nature_service{
        nature_repository,
        world_service};

    test_empty_nature(nature_service);

    const auto forest_biome_id =
        create_forest_biome(nature_service);

    test_biome_operations(
        nature_service,
        forest_biome_id);

    const auto region_area_id =
        create_region_area(
            nature_service,
            forest_biome_id);

    const auto place_area_id =
        create_place_area(
            nature_service,
            forest_biome_id);

    test_region_and_place_nature(
        nature_service,
        forest_biome_id,
        region_area_id,
        place_area_id);

    test_place_region_validation(
        nature_service,
        forest_biome_id);

    test_environment_state(
        nature_service,
        place_area_id);

    test_disabled_biome(
        nature_repository,
        nature_service);

    std::cout
        << "All nature service tests passed.\n";

    return 0;
  }
  catch (const std::exception &exception)
  {
    std::cerr
        << "Nature service test failure: "
        << exception.what()
        << '\n';

    return 1;
  }
}
