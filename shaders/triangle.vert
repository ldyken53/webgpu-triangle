#version 450 core

layout(location = 0) in vec4 pos;

layout(location = 0) out vec4 frag_pos;

// Our uniform buffer containing the projection * view matrix
layout(set = 0, binding = 0, std140) uniform ViewParams {
    mat4 proj_view;
};

void main(void) {
    frag_pos = (pos + 1) * 5000;
    gl_Position =  proj_view * pos;
}