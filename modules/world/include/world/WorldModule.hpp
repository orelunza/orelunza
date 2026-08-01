/**
 *
 * @file WorldModule.hpp
 * @author Softadastra
 * @brief Composition root for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_WORLD_MODULE_HPP_INCLUDED
#define ORELUNZA_WORLD_WORLD_MODULE_HPP_INCLUDED

namespace vix
{
  class App;
}

namespace vix::db
{
  class Database;
}

namespace orelunza::identity::services
{
  class IdentityService;
}

namespace orelunza::world::services
{
  class WorldService;
}

namespace orelunza::world
{
  /**
   * @brief Owns and exposes the runtime components of the world module.
   */
  class WorldModule
  {
  public:
    /**
     * @brief Return the stable module name.
     *
     * @return Module name.
     */
    [[nodiscard]] static const char *name() noexcept;

    /**
     * @brief Initialize the world module runtime.
     *
     * @param database Shared application database.
     * @param identity_service Identity service used by authenticated routes.
     */
    static void initialize(
        vix::db::Database &database,
        identity::services::IdentityService &identity_service);

    /**
     * @brief Return whether the module is initialized.
     *
     * @return true when the world runtime is available.
     */
    [[nodiscard]] static bool initialized() noexcept;

    /**
     * @brief Return the initialized world application service.
     *
     * @return World service.
     *
     * @throws std::logic_error when the module is not initialized.
     */
    [[nodiscard]] static services::WorldService &service();

    /**
     * @brief Register the world HTTP routes.
     *
     * @param app Vix application.
     *
     * @throws std::logic_error when the module is not initialized.
     */
    static void register_routes(vix::App &app);

    /**
     * @brief Destroy the world runtime.
     */
    static void shutdown() noexcept;
  };
} // namespace orelunza::world

#endif // ORELUNZA_WORLD_WORLD_MODULE_HPP_INCLUDED
