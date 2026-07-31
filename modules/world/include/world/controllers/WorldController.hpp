#ifndef orelunza_world_controller_hpp
#define orelunza_world_controller_hpp

namespace vix
{
  class App;
}

namespace orelunza::world::controllers
{
  class WorldController
  {
  public:
    static void register_routes(vix::App &app);
  };
} // namespace orelunza::world::controllers

#endif // orelunza_world_controller_hpp
