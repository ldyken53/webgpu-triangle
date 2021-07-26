// Fragment shader
#version 450 core

// Input: fragment color
layout(location = 0) in vec4 frag_pos;

// Output: fragment color
layout(location = 0) out vec4 color;

layout(set = 0, binding = 1) uniform texture2D colormap;
layout(set = 0, binding = 2) uniform sampler mySampler;
layout(set = 0, binding = 3, std430) buffer AdjacencyMatrix {
    float matrix[];
};

void main(void) {
    uvec4 ufrag_pos = uvec4(frag_pos);
    uint pixel_index = ufrag_pos.x + 10000 * ufrag_pos.y;

    float value = matrix[pixel_index];
    color = vec4(textureLod(sampler2D(colormap, mySampler), vec2(value, 0.5), 0.f).rgb, 1);
}