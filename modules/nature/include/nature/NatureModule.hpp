/**
 *
 * @file NatureModule.hpp
 * @author Softadastra
 * @brief Runtime entry point for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_NATURE_MODULE_HPP_INCLUDED
#define ORELUNZA_NATURE_NATURE_MODULE_HPP_INCLUDED

namespace vix
{
  class App;
}

namespace vix::db
{
  class Database;
}

namespace orelunza::world::services
{
  class WorldService;
}

namespace orelunza::nature::services
{
  class NatureService;
}

namespace orelunza::nature
{
  /**
   * @brief Owns and coordinates the runtime components of the nature module.
   *
   * NatureModule creates the database repository, application service,
   * and HTTP controller bindings used by the Orelunza nature subsystem.
   */
  class NatureModule
  {
  public:
    /**
     * @brief Return the stable module name.
     *
     * @return Module name.
     */
    [[nodiscard]] static const char *name() noexcept;

    /**
     * @brief Initialize the nature module.
     *
     * The world module must already be initialized before this function
     * is called.
     *
     * Calling initialize more than once has no effect while the module
     * remains active.
     *
     * @param database Shared application database.
     * @param world_service World service used to validate regions and places.
     */
    static void initialize(
        vix::db::Database &database,
        world::services::WorldService &world_service);

    /**
     * @brief Return whether the module is initialized.
     *
     * @return true when the nature runtime exists.
     */
    [[nodiscard]] static bool initialized() noexcept;

    /**
     * @brief Return the nature application service.
     *
     * @return Initialized nature service.
     *
     * @throws std::logic_error when the module is not initialized.
     */
    [[nodiscard]] static services::NatureService &service();

    /**
     * @brief Register all public nature routes.
     *
     * The module must be initialized before routes are registered.
     *
     * @param app Vix application.
     *
     * @throws std::logic_error when the module is not initialized.
     */
    static void register_routes(vix::App &app);

    /**
     * @brief Destroy the nature runtime.
     *
     * Calling shutdown on an inactive module has no effect.
     */
    static void shutdown() noexcept;
  };
} // namespace orelunza::nature

#endif // ORELUNZA_NATURE_NATURE_MODULE_HPP_INCLUDED
