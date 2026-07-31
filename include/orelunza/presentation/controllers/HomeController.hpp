/**
 * @file HomeController.hpp
 * @brief Home API routes for the orelunza backend.
 */

#ifndef VIX_GENERATED_BACKEND_ORELUNZA_HOME_CONTROLLER_HPP
#define VIX_GENERATED_BACKEND_ORELUNZA_HOME_CONTROLLER_HPP

namespace vix
{
  class App;
}

namespace orelunza::presentation::controllers
{
  /**
   * @brief Registers public home routes for the backend API.
   *
   * HomeController owns lightweight routes that are useful for verifying
   * that the generated backend is reachable and correctly wired.
   */
  class HomeController
  {
  public:
    /**
     * @brief Register the home routes on the given Vix application.
     *
     * @param app Target application receiving the routes.
     */
    static void register_routes(vix::App &app);
  };
} // namespace orelunza::presentation::controllers

#endif // VIX_GENERATED_BACKEND_ORELUNZA_HOME_CONTROLLER_HPP
