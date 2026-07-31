/**
 *
 * @file IdentityController.hpp
 * @author Softadastra
 * @brief HTTP controller for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_CONTROLLERS_IDENTITY_CONTROLLER_HPP_INCLUDED
#define ORELUNZA_IDENTITY_CONTROLLERS_IDENTITY_CONTROLLER_HPP_INCLUDED

namespace vix
{
  class App;
}

namespace orelunza::identity::services
{
  class IdentityService;
}

namespace orelunza::identity::controllers
{
  /**
   * @brief Registers the HTTP routes exposed by the identity module.
   */
  class IdentityController
  {
  public:
    /**
     * @brief Register the identity HTTP routes.
     *
     * The identity service must outlive all registered route handlers.
     *
     * @param app Vix application.
     * @param service Identity application service.
     */
    static void register_routes(
        vix::App &app,
        services::IdentityService &service);
  };
} // namespace orelunza::identity::controllers

#endif // ORELUNZA_IDENTITY_CONTROLLERS_IDENTITY_CONTROLLER_HPP_INCLUDED
