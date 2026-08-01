/**
 *
 * @file NatureController.hpp
 * @author Softadastra
 * @brief HTTP controller for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_CONTROLLERS_NATURE_CONTROLLER_HPP_INCLUDED
#define ORELUNZA_NATURE_CONTROLLERS_NATURE_CONTROLLER_HPP_INCLUDED

namespace vix
{
  class App;
}

namespace orelunza::nature::services
{
  class NatureService;
}

namespace orelunza::nature::controllers
{
  /**
   * @brief Registers the public nature HTTP routes.
   */
  class NatureController
  {
  public:
    /**
     * @brief Register nature routes on the Vix application.
     *
     * @param app Vix application.
     * @param nature_service Nature application service.
     */
    static void register_routes(
        vix::App &app,
        services::NatureService &nature_service);
  };
} // namespace orelunza::nature::controllers

#endif // ORELUNZA_NATURE_CONTROLLERS_NATURE_CONTROLLER_HPP_INCLUDED
