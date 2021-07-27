#!/usr/bin/env python3

import sys
import os


shaders = ["frag_shader.wgsl", "vert_shader.wgsl"]
compiled_shaders = ""

for shader in shaders:
    with open(shader, "r") as f:
        compiled_code = f.read()
        compiled_shaders += f"const  {shader[:-5]} = `{compiled_code}`;\n"

with open("../wgsl.js", "w") as f:
    f.write(compiled_shaders)

