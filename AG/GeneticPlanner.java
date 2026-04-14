import java.util.*;

public class GeneticPlanner {
    private final Graph graph;
    private final List<Airport> airports;
    private final int populationSize;
    private final int generations;
    private final double crossoverRate;
    private final double mutationRate;
    private final int tournamentSize;
    private final int maxIntermediateStops;
    private final Random random;

    public GeneticPlanner(Graph graph,
                          int populationSize,
                          int generations,
                          double crossoverRate,
                          double mutationRate,
                          int tournamentSize,
                          int maxIntermediateStops) {
        this.graph = graph;
        this.airports = new ArrayList<>(graph.getAirports());
        this.populationSize = populationSize;
        this.generations = generations;
        this.crossoverRate = crossoverRate;
        this.mutationRate = mutationRate;
        this.tournamentSize = tournamentSize;
        this.maxIntermediateStops = maxIntermediateStops;
        this.random = new Random();
    }

    public Route findBestRoute(ShipmentRequest request) {
        List<Chromosome> population = initializePopulation(request);
        evaluatePopulation(population, request);

        Chromosome globalBest = getBest(population);

        for (int generation = 0; generation < generations; generation++) {
            List<Chromosome> newPopulation = new ArrayList<>();

            // 🔥 ELITISMO (RE-EVALUADO)
            Chromosome elite = new Chromosome(globalBest);
            elite.evaluate(graph, request);
            newPopulation.add(elite);

            while (newPopulation.size() < populationSize) {
                Chromosome parent1 = tournamentSelection(population);
                Chromosome parent2 = tournamentSelection(population);

                Chromosome child;
                if (random.nextDouble() < crossoverRate) {
                    child = crossover(parent1, parent2, request);
                } else {
                    child = new Chromosome(parent1);
                }

                if (random.nextDouble() < mutationRate) {
                    mutate(child, request);
                }

                child.evaluate(graph, request);
                newPopulation.add(child);
            }

            population = newPopulation;

            Chromosome generationBest = getBest(population);

            if (generationBest.getFitness() < globalBest.getFitness()) {
                globalBest = new Chromosome(generationBest);
            }

            System.out.println("Generación " + (generation + 1) +
                    " | mejor fitness: " + globalBest.getFitness());
        }

        return globalBest.getRoute();
    }

    private List<Chromosome> initializePopulation(ShipmentRequest request) {
        List<Chromosome> population = new ArrayList<>();

        for (int i = 0; i < populationSize; i++) {
            population.add(createRandomChromosome(request));
        }

        return population;
    }

    private Chromosome createRandomChromosome(ShipmentRequest request) {
        List<Airport> candidates = new ArrayList<>(airports);
        candidates.remove(request.getOrigin());
        candidates.remove(request.getDestination());

        Collections.shuffle(candidates, random);

        int intermediateCount = random.nextInt(maxIntermediateStops + 1);

        List<Airport> genes = new ArrayList<>();
        genes.add(request.getOrigin());

        for (int i = 0; i < intermediateCount && i < candidates.size(); i++) {
            genes.add(candidates.get(i));
        }

        genes.add(request.getDestination());

        return new Chromosome(genes);
    }

    private void evaluatePopulation(List<Chromosome> population, ShipmentRequest request) {
        for (Chromosome chromosome : population) {
            chromosome.evaluate(graph, request);
        }
    }

    // 🔥 PRIORIZA FACTIBLES
    private Chromosome getBest(List<Chromosome> population) {
        return population.stream()
                .min(Comparator
                        .comparing(Chromosome::isFeasible).reversed()
                        .thenComparingDouble(Chromosome::getFitness))
                .orElseThrow();
    }

    private Chromosome tournamentSelection(List<Chromosome> population) {
        List<Chromosome> tournament = new ArrayList<>();

        for (int i = 0; i < tournamentSize; i++) {
            tournament.add(population.get(random.nextInt(population.size())));
        }

        return getBest(tournament);
    }

    private Chromosome crossover(Chromosome p1, Chromosome p2, ShipmentRequest request) {
        List<Airport> middle1 = getMiddleGenes(p1.getGenes());
        List<Airport> middle2 = getMiddleGenes(p2.getGenes());

        List<Airport> childMiddle = new ArrayList<>();

        for (Airport a : middle1) {
            if (random.nextBoolean() && !childMiddle.contains(a)) {
                childMiddle.add(a);
            }
        }

        for (Airport a : middle2) {
            if (random.nextBoolean() && !childMiddle.contains(a)) {
                childMiddle.add(a);
            }
        }

        if (childMiddle.size() > maxIntermediateStops) {
            childMiddle = childMiddle.subList(0, maxIntermediateStops);
        }

        List<Airport> genes = new ArrayList<>();
        genes.add(request.getOrigin());
        genes.addAll(childMiddle);
        genes.add(request.getDestination());

        return new Chromosome(genes);
    }

    private List<Airport> getMiddleGenes(List<Airport> genes) {
        if (genes.size() <= 2) return new ArrayList<>();
        return new ArrayList<>(genes.subList(1, genes.size() - 1));
    }

    private void mutate(Chromosome chromosome, ShipmentRequest request) {
        List<Airport> genes = chromosome.getGenes();

        if (genes.size() <= 2) {
            addRandomIntermediate(genes, request);
            return;
        }

        int type = random.nextInt(3);

        switch (type) {
            case 0 -> swapIntermediate(genes);
            case 1 -> removeIntermediate(genes);
            case 2 -> addRandomIntermediate(genes, request);
        }
    }

    private void swapIntermediate(List<Airport> genes) {
        if (genes.size() <= 3) return;

        int i = 1 + random.nextInt(genes.size() - 2);
        int j = 1 + random.nextInt(genes.size() - 2);

        Collections.swap(genes, i, j);
    }

    private void removeIntermediate(List<Airport> genes) {
        if (genes.size() > 2) {
            int index = 1 + random.nextInt(genes.size() - 2);
            genes.remove(index);
        }
    }

    private void addRandomIntermediate(List<Airport> genes, ShipmentRequest request) {
        if (genes.size() - 2 >= maxIntermediateStops) return;

        List<Airport> available = new ArrayList<>(airports);
        available.remove(request.getOrigin());
        available.remove(request.getDestination());
        available.removeAll(genes);

        if (available.isEmpty()) return;

        Airport newAirport = available.get(random.nextInt(available.size()));
        int pos = 1 + random.nextInt(genes.size() - 1);
        genes.add(pos, newAirport);
    }
}