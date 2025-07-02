import * as d3 from 'd3';

export default class Simulation {
    render() {
        let simulation = d3.forceSimulation(nodes)
            .force('charge', d3.forceManyBody().strength(-25))
            .force('x', d3.forceX(width / 2).strength(0.07))
            .force('y', d3.forceY(height / 2).strength(0.07))
            .force('collide', d3.forceCollide().radius(47))
            .force('link', d3.forceLink(links)
                .id(link => link.id)
                .distance(25)
                .strength(0.1));

        return simulation;
    }
}