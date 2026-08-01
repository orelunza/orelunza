/**
 *
 * @file WorldController.hpp
 * @author Softadastra
 * @brief HTTP controller for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_CONTROLLERS_WORLD_CONTROLLER_HPP_INCLUDED
#define ORELUNZA_WORLD_CONTROLLERS_WORLD_CONTROLLER_HPP_INCLUDED

namespace vix
{
  class App;
}

namespace orelunza::identity::services
{
  class IdentityService;
}

namespace orelunza::world::services
{
  class WorldService;
}

namespace orelunza::world::controllers
{
  /**
   * @brief Registers the public and authenticated world HTTP routes.
   */
  class WorldController
  {
  public:
    /**
     * @brief Register world routes on the Vix application.
     *
     * @param app Vix application.
     * @param world_service World application service.
     * @param identity_service Identity service used to authenticate humans.
     */
    static void register_routes(
        vix::App &app,
        services::WorldService &world_service,
        identity::services::IdentityService &identity_service);
  };
} // namespace orelunza::world::controllers

#endif // ORELUNZA_WORLD_CONTROLLERS_WORLD_CONTROLLER_HPP_INCLUDED
