#include <world/controllers/WorldController.hpp>

#include <vix.hpp>

namespace orelunza::world::controllers
{
  void WorldController::register_routes(vix::App &app)
  {
    app.get("/api/world", [](vix::Request &req, vix::Response &res)
    {
      (void)req;

      res.json({
        "ok", true,
        "module", "world",
        "message", "World module is available"
      });
    });
  }
} // namespace orelunza::world::controllers
