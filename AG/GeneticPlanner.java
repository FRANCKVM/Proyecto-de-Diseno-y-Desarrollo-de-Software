import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Random;

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

            newPopulation.add(new Chromosome(globalBest)); // elitismo

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

    private Chromosome getBest(List<Chromosome> population) {
        return Collections.min(population, Comparator.comparingDouble(Chromosome::getFitness));
    }

    private Chromosome tournamentSelection(List<Chromosome> population) {
        List<Chromosome> tournament = new ArrayList<>();

        for (int i = 0; i < tournamentSize; i++) {
            Chromosome candidate = population.get(random.nextInt(population.size()));
            tournament.add(candidate);
        }

        return getBest(tournament);
    }

    private Chromosome crossover(Chromosome parent1, Chromosome parent2, ShipmentRequest request) {
        List<Airport> p1 = parent1.getGenes();
        List<Airport> p2 = parent2.getGenes();

        List<Airport> childGenes = new ArrayList<>();
        childGenes.add(request.getOrigin());

        List<Airport> middle1 = getMiddleGenes(p1);
        List<Airport> middle2 = getMiddleGenes(p2);

        int split1 = middle1.isEmpty() ? 0 : random.nextInt(middle1.size() + 1);
        int split2 = middle2.isEmpty() ? 0 : random.nextInt(middle2.size() + 1);

        List<Airport> childMiddle = new ArrayList<>();

        for (int i = 0; i < split1; i++) {
            Airport airport = middle1.get(i);
            if (!childMiddle.contains(airport)) {
                childMiddle.add(airport);
            }
        }

        for (int i = split2; i < middle2.size(); i++) {
            Airport airport = middle2.get(i);
            if (!childMiddle.contains(airport)) {
                childMiddle.add(airport);
            }
        }

        if (childMiddle.size() > maxIntermediateStops) {
            childMiddle = childMiddle.subList(0, maxIntermediateStops);
        }

        childGenes.addAll(childMiddle);
        childGenes.add(request.getDestination());

        return new Chromosome(childGenes);
    }

    private List<Airport> getMiddleGenes(List<Airport> genes) {
        if (genes.size() <= 2) {
            return new ArrayList<>();
        }
        return new ArrayList<>(genes.subList(1, genes.size() - 1));
    }

    private void mutate(Chromosome chromosome, ShipmentRequest request) {
        List<Airport> genes = chromosome.getGenes();

        if (genes.size() <= 2) {
            if (random.nextBoolean()) {
                addRandomIntermediate(genes, request);
            }
            return;
        }

        int mutationType = random.nextInt(3);

        switch (mutationType) {
            case 0 -> swapIntermediate(genes);
            case 1 -> removeIntermediate(genes);
            case 2 -> addRandomIntermediate(genes, request);
            default -> {
            }
        }
    }

    private void swapIntermediate(List<Airport> genes) {
        if (genes.size() <= 3) {
            return;
        }

        int i = 1 + random.nextInt(genes.size() - 2);
        int j = 1 + random.nextInt(genes.size() - 2);

        Airport temp = genes.get(i);
        genes.set(i, genes.get(j));
        genes.set(j, temp);
    }

    private void removeIntermediate(List<Airport> genes) {
        if (genes.size() <= 2) {
            return;
        }

        if (genes.size() > 2) {
            int index = 1 + random.nextInt(genes.size() - 2);
            genes.remove(index);
        }
    }

    private void addRandomIntermediate(List<Airport> genes, ShipmentRequest request) {
        if (genes.size() - 2 >= maxIntermediateStops) {
            return;
        }

        List<Airport> available = new ArrayList<>(airports);
        available.remove(request.getOrigin());
        available.remove(request.getDestination());
        available.removeAll(genes);

        if (available.isEmpty()) {
            return;
        }

        Airport newAirport = available.get(random.nextInt(available.size()));
        int insertPos = 1 + random.nextInt(genes.size() - 1);
        genes.add(insertPos, newAirport);
    }
}