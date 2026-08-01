/**
 *
 * @file WorldModule.cpp
 * @author Softadastra
 * @brief Composition root implementation for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <world/WorldModule.hpp>

#include <identity/services/IdentityService.hpp>

#include <world/controllers/WorldController.hpp>
#include <world/repositories/DbWorldRepository.hpp>
#include <world/services/WorldService.hpp>

#include <vix.hpp>
#include <vix/db.hpp>

#include <memory>
#include <stdexcept>

namespace
{
  namespace identity_services = orelunza::identity::services;
  namespace world_controllers = orelunza::world::controllers;
  namespace world_repositories = orelunza::world::repositories;
  namespace world_services = orelunza::world::services;

  /**
   * @brief Runtime objects owned by the world module.
   */
  struct WorldRuntime
  {
    WorldRuntime(
        vix::db::Database &database,
        identity_services::IdentityService &identity)
        : repository(database),
          service(repository),
          identity_service(&identity)
    {
    }

    world_repositories::DbWorldRepository repository;
    world_services::WorldService service;

    identity_services::IdentityService *identity_service = nullptr;
  };

  std::unique_ptr<WorldRuntime> world_runtime;
} // namespace

namespace orelunza::world
{
  const char *WorldModule::name() noexcept
  {
    return "world";
  }

  void WorldModule::initialize(
      vix::db::Database &database,
      identity::services::IdentityService &identity_service)
  {
    if (world_runtime != nullptr)
    {
      return;
    }

    auto runtime = std::make_unique<WorldRuntime>(
        database,
        identity_service);

    if (!runtime->repository.ready())
    {
      throw std::runtime_error(
          "Unable to initialize the world module: " +
          runtime->repository.schema_status()
              .error()
              .message());
    }

    world_runtime = std::move(runtime);
  }

  bool WorldModule::initialized() noexcept
  {
    return world_runtime != nullptr;
  }

  services::WorldService &WorldModule::service()
  {
    if (world_runtime == nullptr)
    {
      throw std::logic_error(
          "WorldModule is not initialized.");
    }

    return world_runtime->service;
  }

  void WorldModule::register_routes(vix::App &app)
  {
    if (world_runtime == nullptr ||
        world_runtime->identity_service == nullptr)
    {
      throw std::logic_error(
          "WorldModule must be initialized before "
          "registering routes.");
    }

    world_controllers::WorldController::register_routes(
        app,
        world_runtime->service,
        *world_runtime->identity_service);
  }

  void WorldModule::shutdown() noexcept
  {
    world_runtime.reset();
  }
} // namespace orelunza::world
