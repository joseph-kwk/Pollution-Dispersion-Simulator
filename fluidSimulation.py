
from phi.flow import *
from phi.flow import Domain, Box
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation

# dark mode
plt.style.use("dark_background")

# domain 
# 2D domain
domain = Domain(x=25, y=25, bounds=Box[0:25, 0:25], boundaries='periodic')
dt= 0.05
viscosity = 0.01
