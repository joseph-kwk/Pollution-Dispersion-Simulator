from phi.flow import *
import matplotlib.pyplot as plt
import matplotlib.animation as animation

# Set up a simple domain
resolution = [32, 32]
bounds = Box(x=(0, 1), y=(0, 1))

# Create initial velocity field (two opposite vortices)
velocity = StaggeredGrid(
    values=0,
    bounds=bounds,
    resolution=resolution,
    extrapolation=extrapolation.BOUNDARY
)

# Add two simple vortices
velocity = velocity + CenteredGrid(
    values={
        'x': lambda x: math.sin(x.vector['y'] * 2 * math.pi),
        'y': lambda x: -math.cos(x.vector['x'] * 2 * math.pi)
    },
    bounds=bounds,
    resolution=resolution
).at(velocity)

# Set up visualization
plt.style.use('dark_background')
fig, ax = plt.subplots(figsize=(8, 8))
ax.set_facecolor('black')
fig.patch.set_facecolor('black')

# Physical parameters
dt = 0.05
viscosity = 0.01

def step(v):
    v = advect.mac_cormack(v, v, dt)
    v = diffuse.explicit(v, viscosity, dt)
    v = fluid.make_incompressible(v)
    return v

# Initial plot
magnitude = field.mean(velocity ** 2, 'vector') ** 0.5
flow_plot = ax.imshow(
    magnitude.values.numpy('y,x'),
    cmap='inferno',
    interpolation='bilinear'
)
plt.colorbar(flow_plot, label='Velocity Magnitude')
ax.set_title('Fluid Flow', color='white')

def animate(frame):
    global velocity
    velocity = step(velocity)
    magnitude = field.mean(velocity ** 2, 'vector') ** 0.5
    flow_plot.set_array(magnitude.values.numpy('y,x'))
    return [flow_plot]

anim = animation.FuncAnimation(
    fig,
    animate,
    frames=200,
    interval=50,
    blit=True
)

plt.show()