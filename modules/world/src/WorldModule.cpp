#include <world/WorldModule.hpp>
#include <world/controllers/WorldController.hpp>

#include <vix.hpp>

namespace orelunza::world
{
  const char *WorldModule::name()
  {
    return "world";
  }

  void WorldModule::register_routes(vix::App &app)
  {
    controllers::WorldController::register_routes(app);
  }
} // namespace orelunza::world
