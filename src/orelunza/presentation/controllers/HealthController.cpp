/**
 * @file HealthController.cpp
 * @brief Health route implementation for the orelunza backend.
 */

#include <orelunza/presentation/controllers/HealthController.hpp>

#include <vix.hpp>

namespace orelunza::presentation::controllers
{
  void HealthController::register_routes(vix::App &app)
  {
    app.get("/health", [](vix::Request &req, vix::Response &res)
    {
      (void)req;

      res.json({
        "ok", true,
        "status", "ok",
        "service", "orelunza"
      });
    });

    app.get("/api/health", [](vix::Request &req, vix::Response &res)
    {
      (void)req;

      res.json({
        "ok", true,
        "status", "ok",
        "service", "orelunza",
        "api", true
      });
    });
  }
} // namespace orelunza::presentation::controllers
