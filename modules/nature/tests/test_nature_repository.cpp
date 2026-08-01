/**
 *
 * @file test_nature_repository.cpp
 * @author Softadastra
 * @brief Repository tests for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <nature/domain/Biome.hpp>
#include <nature/domain/EnvironmentState.hpp>
#include <nature/domain/NaturalArea.hpp>
#include <nature/errors/NatureError.hpp>
#include <nature/repositories/DbNatureRepository.hpp>

#include <world/domain/WorldIds.hpp>

#include <vix/db/Database.hpp>

#include <cstdint>
#include <exception>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>

namespace
{
  using orelunza::nature::domain::Biome;
  using orelunza::nature::domain::BiomeId;
  using orelunza::nature::domain::EnvironmentState;
  using orelunza::nature::domain::NaturalArea;
  using orelunza::nature::domain::NaturalAreaId;
  using orelunza::nature::errors::NatureErrorCode;
  using orelunza::nature::repositories::DbNatureRepository;
  using orelunza::world::domain::PlaceId;
  using orelunza::world::domain::RegionId;

  void require(
      bool condition,
      const std::string &message)
  {
    if (!condition)
    {
      throw std::runtime_error(message);
    }
  }

  Biome make_forest_biome()
  {
    return Biome{
        BiomeId{"biome_forest"},
        "Forest",
        "forest",
        "A dense and peaceful forest biome.",
        "woodland",
        "trees",
        true,
        100,
        100};
  }

  NaturalArea make_region_area()
  {
    return NaturalArea{
        NaturalAreaId{"area_forest_region"},
        BiomeId{"biome_forest"},
        RegionId{"region_forest"},
        std::nullopt,
        "Silent Forest",
        "The natural environment of the forest region.",
        true,
        110,
        110};
  }

  NaturalArea make_place_area()
  {
    return NaturalArea{
        NaturalAreaId{"area_quiet_river"},
        BiomeId{"biome_forest"},
        RegionId{"region_forest"},
        PlaceId{"place_river"},
        "Quiet River",
        "A peaceful river surrounded by trees.",
        true,
        120,
        120};
  }

  void test_schema_initialization(
      DbNatureRepository &repository)
  {
    require(
        repository.ready(),
        "Nature repository schema must initialize.");

    require(
        repository.schema_status().ok(),
        "Nature repository schema status must be successful.");
  }

  void test_biome_persistence(
      DbNatureRepository &repository)
  {
    const auto biome = make_forest_biome();

    auto create_status =
        repository.create_biome(biome);

    require(
        create_status.ok(),
        "Biome creation must succeed.");

    auto by_id =
        repository.find_biome_by_id(
            BiomeId{"biome_forest"});

    require(
        by_id.ok(),
        "Biome lookup by identifier must succeed.");

    require(
        by_id.value().has_value(),
        "Biome lookup by identifier must return a value.");

    require(
        by_id.value()->name() == "Forest",
        "Persisted biome name must match.");

    require(
        by_id.value()->terrain_type() == "woodland",
        "Persisted terrain type must match.");

    require(
        by_id.value()->vegetation_type() == "trees",
        "Persisted vegetation type must match.");

    auto by_slug =
        repository.find_biome_by_slug("forest");

    require(
        by_slug.ok(),
        "Biome lookup by slug must succeed.");

    require(
        by_slug.value().has_value(),
        "Biome lookup by slug must return a value.");

    require(
        by_slug.value()->id() ==
            BiomeId{"biome_forest"},
        "Biome lookup by slug must return the correct biome.");

    auto list_result =
        repository.list_biomes();

    require(
        list_result.ok(),
        "Biome listing must succeed.");

    require(
        list_result.value().size() == 1,
        "Biome listing must contain one biome.");

    auto duplicate_id =
        repository.create_biome(biome);

    require(
        duplicate_id.failed(),
        "Duplicate biome identifier must be rejected.");

    require(
        duplicate_id.error().is(
            NatureErrorCode::InvalidInput),
        "Duplicate biome identifier must return invalid_input.");

    const Biome duplicate_slug{
        BiomeId{"biome_other"},
        "Other Forest",
        "forest",
        "Another forest.",
        "woodland",
        "trees",
        true,
        101,
        101};

    auto duplicate_slug_status =
        repository.create_biome(duplicate_slug);

    require(
        duplicate_slug_status.failed(),
        "Duplicate biome slug must be rejected.");

    require(
        duplicate_slug_status.error().is(
            NatureErrorCode::InvalidInput),
        "Duplicate biome slug must return invalid_input.");
  }

  void test_biome_update(
      DbNatureRepository &repository)
  {
    Biome updated{
        BiomeId{"biome_forest"},
        "Ancient Forest",
        "ancient-forest",
        "An ancient forest filled with large trees.",
        "woodland",
        "ancient_trees",
        true,
        100,
        130};

    auto update_status =
        repository.update_biome(updated);

    require(
        update_status.ok(),
        "Biome update must succeed.");

    auto result =
        repository.find_biome_by_id(
            BiomeId{"biome_forest"});

    require(
        result.ok() &&
            result.value().has_value(),
        "Updated biome must remain available.");

    require(
        result.value()->name() == "Ancient Forest",
        "Updated biome name must be persisted.");

    require(
        result.value()->slug() == "ancient-forest",
        "Updated biome slug must be persisted.");

    require(
        result.value()->updated_at() == 130,
        "Updated biome timestamp must be persisted.");
  }

  void test_natural_area_persistence(
      DbNatureRepository &repository)
  {
    const auto region_area = make_region_area();

    auto region_create =
        repository.create_natural_area(region_area);

    require(
        region_create.ok(),
        "Region natural area creation must succeed.");

    auto region_result =
        repository.find_natural_area_by_region(
            RegionId{"region_forest"});

    require(
        region_result.ok(),
        "Region natural area lookup must succeed.");

    require(
        region_result.value().has_value(),
        "Region natural area must exist.");

    require(
        region_result.value()->region_wide(),
        "Region natural area must not target a place.");

    require(
        region_result.value()->id() ==
            NaturalAreaId{"area_forest_region"},
        "Region natural area identifier must match.");

    const auto place_area = make_place_area();

    auto place_create =
        repository.create_natural_area(place_area);

    require(
        place_create.ok(),
        "Place natural area creation must succeed.");

    auto place_result =
        repository.find_natural_area_by_place(
            PlaceId{"place_river"});

    require(
        place_result.ok(),
        "Place natural area lookup must succeed.");

    require(
        place_result.value().has_value(),
        "Place natural area must exist.");

    require(
        place_result.value()->has_place(),
        "Place natural area must contain a place.");

    require(
        place_result.value()->belongs_to_place(
            PlaceId{"place_river"}),
        "Place natural area must reference the expected place.");

    auto by_id =
        repository.find_natural_area_by_id(
            NaturalAreaId{"area_quiet_river"});

    require(
        by_id.ok() &&
            by_id.value().has_value(),
        "Natural area lookup by identifier must succeed.");

    require(
        by_id.value()->uses_biome(
            BiomeId{"biome_forest"}),
        "Natural area must preserve its biome.");

    auto biome_areas =
        repository.list_natural_areas_by_biome(
            BiomeId{"biome_forest"});

    require(
        biome_areas.ok(),
        "Biome area listing must succeed.");

    require(
        biome_areas.value().size() == 2,
        "Biome area listing must contain both areas.");

    auto duplicate_region =
        repository.create_natural_area(
            NaturalArea{
                NaturalAreaId{"area_duplicate_region"},
                BiomeId{"biome_forest"},
                RegionId{"region_forest"},
                std::nullopt,
                "Duplicate Region Area",
                "This area must be rejected.",
                true,
                121,
                121});

    require(
        duplicate_region.failed(),
        "A second region-wide area must be rejected.");

    auto duplicate_place =
        repository.create_natural_area(
            NaturalArea{
                NaturalAreaId{"area_duplicate_place"},
                BiomeId{"biome_forest"},
                RegionId{"region_forest"},
                PlaceId{"place_river"},
                "Duplicate Place Area",
                "This area must be rejected.",
                true,
                122,
                122});

    require(
        duplicate_place.failed(),
        "A second natural area for one place must be rejected.");
  }

  void test_natural_area_update(
      DbNatureRepository &repository)
  {
    NaturalArea updated{
        NaturalAreaId{"area_quiet_river"},
        BiomeId{"biome_forest"},
        RegionId{"region_forest"},
        PlaceId{"place_river"},
        "Ancient River",
        "A river flowing through the ancient forest.",
        true,
        120,
        140};

    auto update_status =
        repository.update_natural_area(updated);

    require(
        update_status.ok(),
        "Natural area update must succeed.");

    auto result =
        repository.find_natural_area_by_id(
            NaturalAreaId{"area_quiet_river"});

    require(
        result.ok() &&
            result.value().has_value(),
        "Updated natural area must remain available.");

    require(
        result.value()->name() == "Ancient River",
        "Updated natural area name must be persisted.");

    require(
        result.value()->updated_at() == 140,
        "Updated natural area timestamp must be persisted.");
  }

  void test_environment_state_persistence(
      DbNatureRepository &repository)
  {
    EnvironmentState state{
        NaturalAreaId{"area_quiet_river"},
        "soft_ground",
        "healthy",
        "The river flows quietly under the trees.",
        85,
        70,
        150};

    auto save_status =
        repository.save_environment_state(state);

    require(
        save_status.ok(),
        "Environment state creation must succeed.");

    auto result =
        repository.find_environment_state(
            NaturalAreaId{"area_quiet_river"});

    require(
        result.ok(),
        "Environment state lookup must succeed.");

    require(
        result.value().has_value(),
        "Environment state must exist.");

    require(
        result.value()->terrain_condition() ==
            "soft_ground",
        "Terrain condition must be persisted.");

    require(
        result.value()->vegetation_density() == 85,
        "Vegetation density must be persisted.");

    require(
        result.value()->water_level() == 70,
        "Water level must be persisted.");

    EnvironmentState replacement{
        NaturalAreaId{"area_quiet_river"},
        "wet_ground",
        "growing",
        "Recent rain increased the river level.",
        90,
        88,
        160};

    auto replacement_status =
        repository.save_environment_state(
            replacement);

    require(
        replacement_status.ok(),
        "Environment state replacement must succeed.");

    auto updated =
        repository.find_environment_state(
            NaturalAreaId{"area_quiet_river"});

    require(
        updated.ok() &&
            updated.value().has_value(),
        "Replaced environment state must exist.");

    require(
        updated.value()->terrain_condition() ==
            "wet_ground",
        "Replaced terrain condition must be persisted.");

    require(
        updated.value()->water_level() == 88,
        "Replaced water level must be persisted.");

    require(
        updated.value()->updated_at() == 160,
        "Replaced state timestamp must be persisted.");
  }

  void test_missing_values(
      DbNatureRepository &repository)
  {
    auto missing_biome =
        repository.find_biome_by_id(
            BiomeId{"biome_missing"});

    require(
        missing_biome.ok(),
        "Missing biome lookup must not be a storage error.");

    require(
        !missing_biome.value().has_value(),
        "Missing biome lookup must return an empty optional.");

    auto missing_area =
        repository.find_natural_area_by_id(
            NaturalAreaId{"area_missing"});

    require(
        missing_area.ok(),
        "Missing natural area lookup must succeed.");

    require(
        !missing_area.value().has_value(),
        "Missing natural area lookup must return empty.");

    auto missing_state =
        repository.find_environment_state(
            NaturalAreaId{"area_forest_region"});

    require(
        missing_state.ok(),
        "Missing environment state lookup must succeed.");

    require(
        !missing_state.value().has_value(),
        "Missing environment state must return empty.");
  }
} // namespace

int main()
{
  try
  {
    auto database =
        vix::db::Database::sqlite(":memory:");

    DbNatureRepository repository{database};

    test_schema_initialization(repository);
    test_biome_persistence(repository);
    test_biome_update(repository);
    test_natural_area_persistence(repository);
    test_natural_area_update(repository);
    test_environment_state_persistence(repository);
    test_missing_values(repository);

    std::cout
        << "All nature repository tests passed.\n";

    return 0;
  }
  catch (const std::exception &exception)
  {
    std::cerr
        << "Nature repository test failure: "
        << exception.what()
        << '\n';

    return 1;
  }
}
