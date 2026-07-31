/**
 * @file RouteRegistry.cpp
 * @brief Route registration implementation for the orelunza backend.
 */

#include <orelunza/presentation/routes/RouteRegistry.hpp>
#include <orelunza/presentation/controllers/HomeController.hpp>
#include <orelunza/presentation/controllers/HealthController.hpp>

#include <vix.hpp>

namespace orelunza::presentation::routes
{
  void RouteRegistry::register_all(vix::App &app)
  {
    controllers::HomeController::register_routes(app);
    controllers::HealthController::register_routes(app);
  }
} // namespace orelunza::presentation::routes
