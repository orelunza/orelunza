/**
 *
 * @file IdentityModule.cpp
 * @author Softadastra
 * @brief Composition implementation for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/IdentityModule.hpp>

#include <identity/auth/RixAuthProvider.hpp>
#include <identity/controllers/IdentityController.hpp>
#include <identity/repositories/DbIdentityRepository.hpp>
#include <identity/services/IdentityService.hpp>

#include <rix/auth/Auth.hpp>
#include <rix/auth/stores/DbSessionStore.hpp>
#include <rix/auth/stores/DbUserStore.hpp>

#include <vix.hpp>
#include <vix/db/Database.hpp>

#include <memory>
#include <stdexcept>
#include <string>
#include <utility>

namespace orelunza::identity
{
  namespace
  {
    /**
     * @brief Owns the complete identity dependency graph.
     *
     * Member declaration order is important:
     *
     * - authentication stores outlive rix_auth;
     * - rix_auth outlives auth_provider;
     * - auth_provider and repository outlive identity_service.
     */
    class IdentityRuntime
    {
    public:
      explicit IdentityRuntime(vix::db::Database &database)
          : users(database),
            sessions(database),
            rix_auth(users, sessions),
            auth_provider(rix_auth),
            repository(database),
            identity_service(auth_provider, repository)
      {
        validate_initialization();
      }

      IdentityRuntime(const IdentityRuntime &) = delete;
      IdentityRuntime &operator=(const IdentityRuntime &) = delete;

      IdentityRuntime(IdentityRuntime &&) = delete;
      IdentityRuntime &operator=(IdentityRuntime &&) = delete;

      rixlib::auth::DbUserStore users;
      rixlib::auth::DbSessionStore sessions;

      rixlib::auth::Auth rix_auth;

      auth::RixAuthProvider auth_provider;

      repositories::DbIdentityRepository repository;

      services::IdentityService identity_service;

    private:
      void validate_initialization() const
      {
        if (!users.ready())
        {
          throw std::runtime_error(
              std::string{
                  "Failed to initialize the Rix user store: "} +
              users.schema_status().error().message());
        }

        if (!sessions.ready())
        {
          throw std::runtime_error(
              std::string{
                  "Failed to initialize the Rix session store: "} +
              sessions.schema_status().error().message());
        }

        if (!repository.ready())
        {
          throw std::runtime_error(
              std::string{
                  "Failed to initialize the identity repository: "} +
              repository.schema_status().error().message());
        }
      }
    };

    std::unique_ptr<IdentityRuntime> runtime;
  } // namespace

  const char *IdentityModule::name() noexcept
  {
    return "identity";
  }

  void IdentityModule::initialize(
      vix::db::Database &database)
  {
    if (runtime)
    {
      throw std::logic_error(
          "The identity module is already initialized.");
    }

    runtime = std::make_unique<IdentityRuntime>(database);
  }

  bool IdentityModule::initialized() noexcept
  {
    return runtime != nullptr;
  }

  services::IdentityService &IdentityModule::service()
  {
    if (!runtime)
    {
      throw std::logic_error(
          "The identity module is not initialized.");
    }

    return runtime->identity_service;
  }

  void IdentityModule::register_routes(vix::App &app)
  {
    if (!runtime)
    {
      throw std::logic_error(
          "The identity module must be initialized "
          "before registering routes.");
    }

    controllers::IdentityController::register_routes(
        app,
        runtime->identity_service);
  }

  void IdentityModule::shutdown() noexcept
  {
    runtime.reset();
  }
} // namespace orelunza::identity
