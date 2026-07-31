#ifndef orelunza_world_module_hpp
#define orelunza_world_module_hpp

namespace vix
{
  class App;
}

namespace orelunza::world
{
  class WorldModule
  {
  public:
    static const char *name();
    static void register_routes(vix::App &app);
  };
} // namespace orelunza::world

#endif // orelunza_world_module_hpp
