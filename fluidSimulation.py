from phi.flow import *
from phi.geom import Box
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import math

# dark mode
plt.style.use("dark_background")

# domain (phiflow v2+)
domain = dict(x=25, y=25, bounds=Box[0:25, 0:25], boundaries='periodic')
# For StaggeredGrid and CenteredGrid, pass **domain

dt = 0.05
viscosity = 0.01

# Initial velocity field (Taylor-Green vortex)
velocity = StaggeredGrid(lambda x: (math.sin(2 * math.pi * x[1]), math.cos(2 * math.pi * x[0])),
                         **domain,
                         extrapolation=extrapolation.PERIODIC)

# Initializing venom density field
venom_density = CenteredGrid(0, **domain, extrapolation=extrapolation.ZERO)

# plotting for initial state
fig, (ax_vel, ax_den) = plt.subplots(1, 2, figsize=(10, 5))

# plotting initial velocity field
quiver_plot = ax_vel.quiver(velocity.points.x[::2, ::2], velocity.points.y[::2, ::2],
                            velocity[::2, ::2].x, velocity[::2, ::2].y,
                            color='white')
ax_vel.set_title('Initial Fluid Velocity')
ax_vel.set_aspect('equal')

# plotting initial venom density field
im_den = ax_den.imshow(venom_density.values.numpy('y,x'), origin='lower', cmap='plasma')
ax_den.set_title('Initial Venom Density')
ax_den.set_aspect('equal')
plt.tight_layout()
plt.show()

# defining coordinates for venom extraction point
# near the center
venom_source_x = 0.5
venom_source_y = 0.5

#defining strength of venom extraction
venom_injection_strength_vel = 0.1
venom_injection_strength_den = 0.5


def make_step(v, d):
    v = advect.semi_lagrangian(v, v, dt=dt)
    d = advect.semi_lagrangian(d, v, dt=dt)

    # Implicit diffusion
    v = diffuse.implicit(v, viscosity, dt=dt)
    #d = diffuse.implicit(d, viscosity, dt=dt)

    # Pressure correction (phiflow v2+)
    from phi.flow import fluid
    v = fluid.make_incompressible(v)

    # Add Venom at a Specific Point
    # Convert world coordinates to grid indices for the source
    # Note: For CenteredGrid, accessing by (x,y) directly is often possible
    # For StaggeredGrid, careful indexing for velocity components might be needed
    
    # Add outward velocity at the source for the "extraction" effect
    # This directly modifies the velocity field at the source cell
    # might need to adjust the direction of velocity based on your desired exit
    v = v.at[venom_source_x, venom_source_y].add((venom_injection_strength_vel, venom_injection_strength_vel))

    # add venom density at the source
    d = d.at[venom_source_x, venom_source_y].add(venom_injection_strength_den)
    # make sure density does not go above 1
    d = math.clip(d, 0, 1)
    return v, d

# Initialize for the animation loop
velocity_frames = [velocity]
density_frames = [venom_density]

# run simulation for a number of frames
num_frames = 100
for i in range(num_frames):
    velocity, venom_density = make_step(velocity, venom_density)
    velocity_frames.append(velocity)
    density_frames.append(venom_density)
    if i % 10 == 0:
        print(f"Computed frame {i}/{num_frames}")
# Create the animation
fig_amin, (ax_anim_vel, ax_anim_den) = plt.subplots(1, 2, figsize=(12, 6))

# velocity plot
stream_plot = ax_anim_vel.streamplot(velocity_frames[0].points.x.numpy(),
                                     velocity_frames[0].points.y.numpy(),
                                     velocity_frames[0].x.numpy(),
                                     velocity_frames[0].y.numpy(),
                                     color='white', linewidth=1, density=2)
ax_anim_vel.set_title('Fluid Velocity Animation')
ax_anim_vel.set_aspect('equal')

# density plot
im_anim_den = ax_anim_den.imshow(density_frames[0].values.numpy('y,x'),
                                 origin='lower', cmap='plasma', vmin=0, vmax=1)
ax_anim_den.set_title('Venom Density Animation')
ax_anim_den.set_aspect('equal')
plt.colorbar(im_anim_den, ax=ax_anim_den, label='Venom Concentration')

plt.tight_layout()

# Store stream_plot as a global variable so it can be updated

def animate(frame):
    global stream_plot
    # Remove old streamlines
    for coll in stream_plot.lines:
        coll.remove()
    for coll in stream_plot.arrows:
        coll.remove()
    # Create new streamplot
    stream_plot = ax_anim_vel.streamplot(velocity_frames[frame].points.x.numpy(),
                                         velocity_frames[frame].points.y.numpy(),
                                         velocity_frames[frame].x.numpy(),
                                         velocity_frames[frame].y.numpy(),
                                         color='white', linewidth=1, density=2)
    ax_anim_vel.set_title(f'Fluid Velocity Animation(Frame {frame})')
    ax_anim_vel.set_aspect('equal')

    # Update density plot
    im_anim_den.set_array(density_frames[frame].values.numpy('y,x'))
    ax_anim_den.set_title(f'Venom Density Animation(Frame {frame})')

    # Return all updated artists
    return stream_plot.lines + stream_plot.arrows + [im_anim_den]

ani = animation.FuncAnimation(fig_amin, animate, frames=len(velocity_frames), interval=50, blit=False)
plt.show()