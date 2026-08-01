/**
 *
 * @file test_nature.cpp
 * @author Softadastra
 * @brief Module and domain tests for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <nature/NatureModule.hpp>
#include <nature/domain/Biome.hpp>
#include <nature/domain/EnvironmentState.hpp>
#include <nature/domain/NaturalArea.hpp>
#include <nature/domain/NatureIds.hpp>
#include <nature/errors/NatureError.hpp>
#include <nature/services/NatureService.hpp>

#include <world/domain/WorldIds.hpp>
#include <world/repositories/DbWorldRepository.hpp>
#include <world/services/WorldService.hpp>

#include <vix.hpp>
#include <vix/db/Database.hpp>
#include <vix/executor/RuntimeExecutor.hpp>

#include <exception>
#include <iostream>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>

namespace
{
  using orelunza::nature::NatureModule;
  using orelunza::nature::domain::Biome;
  using orelunza::nature::domain::BiomeId;
  using orelunza::nature::domain::EnvironmentState;
  using orelunza::nature::domain::NaturalArea;
  using orelunza::nature::domain::NaturalAreaId;
  using orelunza::nature::errors::NatureError;
  using orelunza::nature::errors::NatureErrorCode;
  using orelunza::world::domain::PlaceId;
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

  void test_identifiers()
  {
    const BiomeId empty_biome;
    const BiomeId forest{"biome_forest"};
    const BiomeId same_forest{"biome_forest"};
    const BiomeId river{"biome_river"};

    require(
        !empty_biome.valid(),
        "Default biome identifier must be invalid.");

    require(
        forest.valid(),
        "Non-empty biome identifier must be valid.");

    require(
        forest.is("biome_forest"),
        "Biome identifier string comparison must succeed.");

    require(
        forest == same_forest,
        "Equal biome identifiers must compare equal.");

    require(
        forest != river,
        "Different biome identifiers must not compare equal.");

    const NaturalAreaId area{"area_forest"};

    require(
        area.valid(),
        "Non-empty natural area identifier must be valid.");

    require(
        static_cast<bool>(area),
        "Valid natural area identifier must convert to true.");
  }

  void test_biome_domain()
  {
    Biome biome{
        BiomeId{"biome_forest"},
        "Forest",
        "forest",
        "A dense forest.",
        "woodland",
        "trees",
        true,
        100,
        100};

    require(
        biome.valid(),
        "Complete biome must be valid.");

    require(
        biome.has_id(
            BiomeId{"biome_forest"}),
        "Biome identifier comparison must succeed.");

    require(
        biome.has_slug("forest"),
        "Biome slug comparison must succeed.");

    require(
        biome.has_terrain_type("woodland"),
        "Biome terrain comparison must succeed.");

    require(
        biome.has_vegetation_type("trees"),
        "Biome vegetation comparison must succeed.");

    biome.set_name("Ancient Forest");
    biome.set_slug("ancient-forest");
    biome.set_description(
        "An ancient and peaceful forest.");
    biome.set_terrain_type("ancient_woodland");
    biome.set_vegetation_type("large_trees");
    biome.set_updated_at(120);

    require(
        biome.name() == "Ancient Forest",
        "Biome name mutation must succeed.");

    require(
        biome.slug() == "ancient-forest",
        "Biome slug mutation must succeed.");

    require(
        biome.updated_at() == 120,
        "Biome update time mutation must succeed.");

    biome.set_enabled(false);

    require(
        biome.disabled(),
        "Disabled biome must report disabled.");

    require(
        biome.valid(),
        "Disabled biome may remain structurally valid.");
  }

  void test_natural_area_domain()
  {
    NaturalArea area{
        NaturalAreaId{"area_forest"},
        BiomeId{"biome_forest"},
        RegionId{"region_forest"},
        std::nullopt,
        "Silent Forest",
        "The natural environment of the region.",
        true,
        100,
        100};

    require(
        area.valid(),
        "Region natural area must be valid.");

    require(
        area.region_wide(),
        "Natural area without place must be region-wide.");

    require(
        area.belongs_to_region(
            RegionId{"region_forest"}),
        "Natural area region comparison must succeed.");

    area.set_place(
        PlaceId{"place_river"});

    require(
        area.has_place(),
        "Natural area must contain the assigned place.");

    require(
        area.belongs_to_place(
            PlaceId{"place_river"}),
        "Natural area place comparison must succeed.");

    area.set_region(
        RegionId{"region_lake"});

    require(
        area.belongs_to_region(
            RegionId{"region_lake"}),
        "Natural area region mutation must succeed.");

    require(
        !area.has_place(),
        "Changing region must clear the existing place.");

    area.set_biome(
        BiomeId{"biome_wetland"});

    require(
        area.uses_biome(
            BiomeId{"biome_wetland"}),
        "Natural area biome mutation must succeed.");

    area.set_enabled(false);

    require(
        area.disabled(),
        "Natural area disabled state must be exposed.");
  }

  void test_environment_state_domain()
  {
    EnvironmentState state{
        NaturalAreaId{"area_river"},
        "wet_ground",
        "healthy",
        "A calm river surrounded by trees.",
        90,
        75,
        100};

    require(
        state.valid(),
        "Complete environment state must be valid.");

    require(
        state.belongs_to(
            NaturalAreaId{"area_river"}),
        "Environment state area comparison must succeed.");

    require(
        state.has_water(),
        "Positive water level must report water.");

    require(
        EnvironmentState::valid_level(0),
        "Zero must be a valid environment level.");

    require(
        EnvironmentState::valid_level(100),
        "One hundred must be a valid environment level.");

    require(
        !EnvironmentState::valid_level(-1),
        "Negative environment level must be invalid.");

    require(
        !EnvironmentState::valid_level(101),
        "Environment level above 100 must be invalid.");

    state.set_terrain_condition("soft_ground");
    state.set_vegetation_condition("growing");
    state.set_ambient_description(
        "Plants are growing beside the river.");
    state.set_vegetation_density(95);
    state.set_water_level(80);
    state.set_updated_at(120);

    require(
        state.terrain_condition() == "soft_ground",
        "Terrain condition mutation must succeed.");

    require(
        state.vegetation_density() == 95,
        "Vegetation density mutation must succeed.");

    require(
        state.water_level() == 80,
        "Water level mutation must succeed.");

    require(
        state.updated_at() == 120,
        "Environment state timestamp mutation must succeed.");
  }

  void test_errors()
  {
    const NatureError success;

    require(
        success.ok(),
        "Default nature error must represent success.");

    require(
        !success.has_error(),
        "Default nature error must contain no error.");

    const NatureError not_found{
        NatureErrorCode::BiomeNotFound,
        "Biome not found."};

    require(
        not_found.failed(),
        "Biome not found error must represent failure.");

    require(
        not_found.is(
            NatureErrorCode::BiomeNotFound),
        "Nature error code comparison must succeed.");

    require(
        orelunza::nature::errors::to_string(
            not_found) == "biome_not_found",
        "Nature error must expose its stable name.");

    require(
        orelunza::nature::errors::to_string(
            NatureErrorCode::StorageError) ==
            "storage_error",
        "Storage error stable name must match.");
  }

  void test_module_lifecycle()
  {
    require(
        std::string{NatureModule::name()} == "nature",
        "Nature module name must be stable.");

    NatureModule::shutdown();

    require(
        !NatureModule::initialized(),
        "Nature module must initially be inactive.");

    bool service_threw = false;

    try
    {
      static_cast<void>(
          NatureModule::service());
    }
    catch (const std::logic_error &)
    {
      service_threw = true;
    }

    require(
        service_threw,
        "Accessing the inactive nature service must throw.");

    auto database =
        vix::db::Database::sqlite(":memory:");

    DbWorldRepository world_repository{
        database};

    require(
        world_repository.ready(),
        "World repository must initialize.");

    WorldService world_service{
        world_repository};

    NatureModule::initialize(
        database,
        world_service);

    require(
        NatureModule::initialized(),
        "Nature module must initialize.");

    auto &first_service =
        NatureModule::service();

    auto &second_service =
        NatureModule::service();

    require(
        &first_service == &second_service,
        "Nature module must expose one service instance.");

    NatureModule::initialize(
        database,
        world_service);

    require(
        &NatureModule::service() ==
            &first_service,
        "Repeated initialization must preserve the runtime.");

    auto executor =
        std::make_shared<
            vix::executor::RuntimeExecutor>(1u);

    vix::App app{executor};

    NatureModule::register_routes(app);

    NatureModule::shutdown();

    require(
        !NatureModule::initialized(),
        "Nature module must stop after shutdown.");

    bool route_registration_threw = false;

    try
    {
      NatureModule::register_routes(app);
    }
    catch (const std::logic_error &)
    {
      route_registration_threw = true;
    }

    require(
        route_registration_threw,
        "Route registration without initialization must throw.");

    NatureModule::shutdown();
  }
} // namespace

int main()
{
  try
  {
    test_identifiers();
    test_biome_domain();
    test_natural_area_domain();
    test_environment_state_domain();
    test_errors();
    test_module_lifecycle();

    std::cout
        << "All nature module tests passed.\n";

    return 0;
  }
  catch (const std::exception &exception)
  {
    orelunza::nature::NatureModule::shutdown();

    std::cerr
        << "Nature module test failure: "
        << exception.what()
        << '\n';

    return 1;
  }
}
