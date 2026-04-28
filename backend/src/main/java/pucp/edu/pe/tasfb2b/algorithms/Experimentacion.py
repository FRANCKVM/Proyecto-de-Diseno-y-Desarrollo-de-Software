import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import shapiro, probplot

# =========================
# DATOS DE EXPERIMENTACIÓN
# =========================

ga = np.array([
    [1500,  1500, 100.00,  5.49, 99.66],
    [3000,  3000, 100.00, 10.81, 99.38],
    [6000,  6000, 100.00, 21.36, 98.85],
    [9000,  8602,  95.58, 31.51, 93.92],
    [12000, 9038,  75.32, 32.95, 73.59]
])

aco = np.array([
    [1500,  1500, 100.00,  9.79, 99.43],
    [3000,  3000, 100.00, 18.27, 98.99],
    [6000,  6000, 100.00, 37.94, 98.01],
    [9000,  8602,  95.58, 54.61, 92.73],
    [12000, 9038,  75.32, 57.18, 72.35]
])

# =========================
# DIFERENCIAS GA - ACO
# =========================

diff_tiempo = ga[:, 3] - aco[:, 3]
diff_pct = ga[:, 2] - aco[:, 2]
diff_fitness = ga[:, 4] - aco[:, 4]

# =========================
# SHAPIRO-WILK
# =========================

print("\n--- Pruebas de normalidad Shapiro-Wilk sobre diferencias GA - ACO ---")

for nombre, datos in [
    ("Tiempo", diff_tiempo),
    ("Porcentaje entregado", diff_pct),
    ("Fitness", diff_fitness)
]:
    stat, p = shapiro(datos)

    print(f"\n{nombre}:")
    print(f"W = {stat:.4f}, p-value = {p:.5f}")

    if p > 0.05:
        print("Se asume normalidad.")
    else:
        print("No se asume normalidad.")


# =========================
# QQ-PLOTS
# =========================
""" def generar_qqplot(datos, titulo):
    plt.figure()
    probplot(datos, dist="norm", plot=plt)
    plt.title(titulo)
    plt.xlabel("Cuantiles teóricos")
    plt.ylabel("Cuantiles observados")
    plt.grid(True)
    plt.show()

generar_qqplot(diff_tiempo, "QQ-plot: diferencias de tiempo GA - ACO")
generar_qqplot(diff_pct, "QQ-plot: diferencias de porcentaje GA - ACO")
generar_qqplot(diff_fitness, "QQ-plot: diferencias de fitness GA - ACO")

 """
from scipy.stats import ttest_rel

# =========================
# PRUEBA T PAREADA
# =========================

tiempo_ga = ga[:, 3]
tiempo_aco = aco[:, 3]

fitness_ga = ga[:, 4]
fitness_aco = aco[:, 4]

t_tiempo, p_tiempo = ttest_rel(tiempo_ga, tiempo_aco)
t_fitness, p_fitness = ttest_rel(fitness_ga, fitness_aco)

alpha = 0.05

print("\n--- Prueba t pareada GA vs ACO ---")

print("\nTiempo de planificación:")
print(f"Media GA = {np.mean(tiempo_ga):.4f}")
print(f"Media ACO = {np.mean(tiempo_aco):.4f}")
print(f"Diferencia media GA - ACO = {np.mean(tiempo_ga - tiempo_aco):.4f}")
print(f"t = {t_tiempo:.4f}")
print(f"p-value = {p_tiempo:.5f}")

if p_tiempo < alpha:
    print("Resultado: existe diferencia significativa entre GA y ACO en tiempo.")
else:
    print("Resultado: no existe diferencia significativa entre GA y ACO en tiempo.")


print("\nFitness:")
print(f"Media GA = {np.mean(fitness_ga):.4f}")
print(f"Media ACO = {np.mean(fitness_aco):.4f}")
print(f"Diferencia media GA - ACO = {np.mean(fitness_ga - fitness_aco):.4f}")
print(f"t = {t_fitness:.4f}")
print(f"p-value = {p_fitness:.5f}")

if p_fitness < alpha:
    print("Resultado: existe diferencia significativa entre GA y ACO en fitness.")
else:
    print("Resultado: no existe diferencia significativa entre GA y ACO en fitness.")
    
    
    # =========================
# EXTRACCIÓN DE DATOS
# =========================

cargas = ga[:, 0]

tiempo_ga = ga[:, 3]
tiempo_aco = aco[:, 3]

fitness_ga = ga[:, 4]
fitness_aco = aco[:, 4]

# =========================
# GRÁFICO 1: TIEMPO
# =========================

plt.figure(figsize=(8, 5))
plt.plot(cargas, tiempo_ga, marker='o', label='GA')
plt.plot(cargas, tiempo_aco, marker='o', label='ACO')
plt.title('Comparación de tiempo de planificación: GA vs ACO')
plt.xlabel('Cantidad de pedidos')
plt.ylabel('Tiempo de planificación')
plt.xticks(cargas)
plt.legend()
plt.grid(True)
plt.show()

# =========================
# GRÁFICO 2: FITNESS
# =========================

plt.figure(figsize=(8, 5))
plt.plot(cargas, fitness_ga, marker='o', label='GA')
plt.plot(cargas, fitness_aco, marker='o', label='ACO')
plt.title('Comparación de fitness: GA vs ACO')
plt.xlabel('Cantidad de pedidos')
plt.ylabel('Fitness')
plt.xticks(cargas)
plt.legend()
plt.grid(True)
plt.show()

# =========================
# GRÁFICO 3: PORCENTAJE DE ENTREGA
# =========================

porcentaje_ga = ga[:, 2]
porcentaje_aco = aco[:, 2]

plt.figure(figsize=(8, 5))
plt.plot(cargas, porcentaje_ga, marker='o', label='GA')
plt.plot(cargas, porcentaje_aco, marker='o', label='ACO')
plt.title('Comparación de porcentaje de pedidos entregados: GA vs ACO')
plt.xlabel('Cantidad de pedidos')
plt.ylabel('Porcentaje de pedidos entregados (%)')
plt.xticks(cargas)
plt.ylim(0, 105)
plt.legend()
plt.grid(True)
plt.show()