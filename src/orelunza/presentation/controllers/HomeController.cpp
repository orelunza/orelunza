/**
 * @file HomeController.cpp
 * @brief Home route implementation for the orelunza backend.
 */

#include <orelunza/presentation/controllers/HomeController.hpp>

#include <vix.hpp>

namespace orelunza::presentation::controllers
{
  void HomeController::register_routes(vix::App &app)
  {
    app.get("/api", [](vix::Request &req, vix::Response &res)
    {
      (void)req;

      res.json({
        "ok", true,
        "service", "orelunza",
        "message", "Vix backend is running"
      });
    });
  }
} // namespace orelunza::presentation::controllers
