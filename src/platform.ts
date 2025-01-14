import {
  Matterbridge,
  MatterbridgeDevice,
  // MatterbridgeEndpoint as MatterbridgeDevice,
  MatterbridgeAccessoryPlatform,
  DeviceTypes,
  PlatformConfig,
  WindowCovering,
  powerSource,
  WindowCoveringCluster,
  TypeFromPartialBitSchema,
  BitFlag,
} from 'matterbridge';
import { isValidNumber } from 'matterbridge/utils';
import { AnsiLogger } from 'matterbridge/logger';

export class ExampleMatterbridgeAccessoryPlatform extends MatterbridgeAccessoryPlatform {
  cover: MatterbridgeDevice | undefined;
  coverInterval: NodeJS.Timeout | undefined;

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('1.6.0')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "1.6.0". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend."`,
      );
    }

    this.log.info('Initializing platform:', this.config.name);
  }

  override async onStart(reason?: string) {
    this.log.info('onStart called with reason:', reason ?? 'none');

    this.cover = new MatterbridgeDevice(DeviceTypes.WINDOW_COVERING, { uniqueStorageKey: 'Cover example device' }, this.config.debug as boolean);
    this.cover.createDefaultIdentifyClusterServer();
    this.cover.createDefaultBasicInformationClusterServer('Cover example device', `0x59108853594}`, 0xfff1, 'Matterbridge', 0x0001, 'Matterbridge Cover');
    this.cover.createDefaultWindowCoveringClusterServer(10000);

    this.cover.addDeviceType(powerSource);
    this.cover.createDefaultPowerSourceWiredClusterServer();

    await this.registerDevice(this.cover);

    this.cover.subscribeAttribute(
      WindowCoveringCluster.id,
      'mode',
      (
        newValue: TypeFromPartialBitSchema<{
          motorDirectionReversed: BitFlag;
          calibrationMode: BitFlag;
          maintenanceMode: BitFlag;
          ledFeedback: BitFlag;
        }>,
        oldValue: TypeFromPartialBitSchema<{
          motorDirectionReversed: BitFlag;
          calibrationMode: BitFlag;
          maintenanceMode: BitFlag;
          ledFeedback: BitFlag;
        }>,
      ) => {
        this.log.info(
          `Attribute mode changed from ${oldValue} to ${newValue}. Reverse: ${newValue.motorDirectionReversed}. Calibration: ${newValue.calibrationMode}. Maintenance: ${newValue.maintenanceMode}. LED: ${newValue.ledFeedback}`,
        );
      },
      this.log,
    );

    this.cover.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.log.info(`Command identify called identifyTime:${identifyTime}`);
    });

    this.cover.addCommandHandler('stopMotion', async () => {
      await this.cover?.setWindowCoveringTargetAsCurrentAndStopped();
      this.cover?.log.info(`Command stopMotion called`);
    });

    this.cover.addCommandHandler('upOrOpen', async () => {
      await this.cover?.setWindowCoveringCurrentTargetStatus(0, 0, WindowCovering.MovementStatus.Stopped);
      this.cover?.log.info(`Command upOrOpen called`);
    });

    this.cover.addCommandHandler('downOrClose', async () => {
      await this.cover?.setWindowCoveringCurrentTargetStatus(10000, 10000, WindowCovering.MovementStatus.Stopped);
      this.cover?.log.info(`Command downOrClose called`);
    });

    this.cover.addCommandHandler('goToLiftPercentage', async ({ request: { liftPercent100thsValue } }) => {
      await this.cover?.setWindowCoveringCurrentTargetStatus(liftPercent100thsValue, liftPercent100thsValue, WindowCovering.MovementStatus.Stopped);
      this.cover?.log.info(`Command goToLiftPercentage ${liftPercent100thsValue} called`);
    });
  }

  override async onConfigure() {
    this.log.info('onConfigure called');

    await this.cover?.setWindowCoveringTargetAsCurrentAndStopped();
    this.log.info('Set cover initial targetPositionLiftPercent100ths = currentPositionLiftPercent100ths and operationalStatus to Stopped.');

    // Matter: 0 Fully open 10000 fully closed
    this.coverInterval = setInterval(async () => {
      if (!this.cover) return;
      let position = this.cover.getAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths', this.log);
      if (!isValidNumber(position, 0, 10000)) return;
      position = position + 1000;
      position = position > 10000 ? 0 : position;
      await this.cover.setWindowCoveringCurrentTargetStatus(position, position, WindowCovering.MovementStatus.Stopped);
      this.log.info(`Set liftPercent100thsValue to ${position}`);
    }, 60 * 1000);
  }

  override async onShutdown(reason?: string) {
    this.log.info('onShutdown called with reason:', reason ?? 'none');
    clearInterval(this.coverInterval);
    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }
}
