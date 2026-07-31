/**
 * @file HealthController.hpp
 * @brief Health check routes for the orelunza backend.
 */

#ifndef VIX_GENERATED_BACKEND_ORELUNZA_HEALTH_CONTROLLER_HPP
#define VIX_GENERATED_BACKEND_ORELUNZA_HEALTH_CONTROLLER_HPP

namespace vix
{
  class App;
}

namespace orelunza::presentation::controllers
{
  /**
   * @brief Registers health check routes for the backend application.
   *
   * HealthController exposes routes intended for local checks, reverse
   * proxies, deployment scripts, and production monitoring.
   */
  class HealthController
  {
  public:
    /**
     * @brief Register health check routes on the given Vix application.
     *
     * @param app Target application receiving the routes.
     */
    static void register_routes(vix::App &app);
  };
} // namespace orelunza::presentation::controllers

#endif // VIX_GENERATED_BACKEND_ORELUNZA_HEALTH_CONTROLLER_HPP
