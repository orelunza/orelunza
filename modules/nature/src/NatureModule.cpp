/**
 *
 * @file NatureModule.cpp
 * @author Softadastra
 * @brief Runtime implementation for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <nature/NatureModule.hpp>

#include <nature/controllers/NatureController.hpp>
#include <nature/repositories/DbNatureRepository.hpp>
#include <nature/services/NatureService.hpp>

#include <world/services/WorldService.hpp>

#include <vix.hpp>
#include <vix/db/Database.hpp>

#include <memory>
#include <stdexcept>

namespace
{
  /**
   * @brief Runtime-owned components of the nature module.
   */
  struct NatureRuntime
  {
    NatureRuntime(
        vix::db::Database &database,
        orelunza::world::services::WorldService &world_service)
        : repository(database),
          service(repository, world_service),
          world_service(&world_service)
    {
    }

    orelunza::nature::repositories::DbNatureRepository repository;
    orelunza::nature::services::NatureService service;

    orelunza::world::services::WorldService *world_service = nullptr;
  };

  std::unique_ptr<NatureRuntime> runtime;
} // namespace

namespace orelunza::nature
{
  const char *NatureModule::name() noexcept
  {
    return "nature";
  }

  void NatureModule::initialize(
      vix::db::Database &database,
      world::services::WorldService &world_service)
  {
    if (runtime)
    {
      return;
    }

    auto candidate =
        std::make_unique<NatureRuntime>(
            database,
            world_service);

    if (!candidate->repository.ready())
    {
      throw std::runtime_error(
          candidate->repository
              .schema_status()
              .error()
              .message());
    }

    runtime = std::move(candidate);
  }

  bool NatureModule::initialized() noexcept
  {
    return runtime != nullptr;
  }

  services::NatureService &NatureModule::service()
  {
    if (!runtime)
    {
      throw std::logic_error(
          "The nature module is not initialized.");
    }

    return runtime->service;
  }

  void NatureModule::register_routes(vix::App &app)
  {
    if (!runtime)
    {
      throw std::logic_error(
          "The nature module must be initialized "
          "before registering its routes.");
    }

    controllers::NatureController::register_routes(
        app,
        runtime->service);
  }

  void NatureModule::shutdown() noexcept
  {
    runtime.reset();
  }
} // namespace orelunza::nature
