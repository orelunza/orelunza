/**
 * @file RouteRegistry.hpp
 * @brief Route registry for the orelunza backend.
 */

#ifndef VIX_GENERATED_BACKEND_ORELUNZA_ROUTE_REGISTRY_HPP
#define VIX_GENERATED_BACKEND_ORELUNZA_ROUTE_REGISTRY_HPP

namespace vix
{
  class App;
}

namespace orelunza::presentation::routes
{
  /**
   * @brief Central registry for application routes.
   *
   * RouteRegistry keeps route registration grouped in one place so the
   * application bootstrap does not need to know about individual controllers.
   */
  class RouteRegistry
  {
  public:
    /**
     * @brief Register all application routes on the given Vix application.
     *
     * @param app Target application receiving the route declarations.
     */
    static void register_all(vix::App &app);
  };
} // namespace orelunza::presentation::routes

#endif // VIX_GENERATED_BACKEND_ORELUNZA_ROUTE_REGISTRY_HPP
