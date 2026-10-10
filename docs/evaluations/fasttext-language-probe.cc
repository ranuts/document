#include <emscripten/bind.h>
#include "fasttext.h"
#include <sstream>
using namespace emscripten;
struct LanguageProbe {
 fasttext::FastText model;
 void load(std::string path) { model.loadModel(path); }
 val predict(std::string text) {
  std::stringstream input(text+"\n");
  std::vector<std::pair<fasttext::real,std::string>> predictions;
  model.predictLine(input,predictions,3,0.0);
  val out=val::array();
  for(auto &p:predictions){val row=val::object();row.set("language",p.second.substr(9));row.set("score",p.first);out.call<void>("push",row);}
  return out;
 }
};
EMSCRIPTEN_BINDINGS(language_probe) {
 class_<LanguageProbe>("LanguageProbe").constructor<>().function("load",&LanguageProbe::load).function("predict",&LanguageProbe::predict);
}
