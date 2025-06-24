import type { Service } from '$types';
import LoggerService, { type GenericLogger } from '$services/logger';
import rabbitmq from '$services/rabbitmq';
import settings from '$services/settings';

class BootstrapService {
	private readonly name = 'bootstrap';
	private logger: GenericLogger;
	private services: Service[];

	/**
	 * bootstrap service constructor
	 *
	 * @example
	 * ```ts
	 * const bootstrapService = new BootstrapService();
	 * ```
	 */
	constructor() {
		this.logger = LoggerService.getSubLogger({
			name: this.name
		});

		this.services = [rabbitmq, settings];
	}

  /**
   * Initializes the services
   *
   * @example
   * ```ts
   * await bootstrapService.init();
   * ```
   */
	public init = async (): Promise<void> => {
		this.logger.info('Initializing services');

		for (const service of this.services) {
      try {
				this.logger.info(`Initializing ${service.name} service`);
				await service.init();
			} catch (error) {
        this.logger.error(`Failed to initialize ${service.name} service`, { error });
      }
		}

		this.logger.info('Services initialized');
	};
}

export default new BootstrapService();
