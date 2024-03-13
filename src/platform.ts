import { DeviceTypes, WindowCovering, WindowCoveringCluster } from 'matterbridge';

import { Matterbridge, MatterbridgeDevice, MatterbridgeAccessoryPlatform } from 'matterbridge';
import { AnsiLogger } from 'node-ansi-logger';

export class ExampleMatterbridgeAccessoryPlatform extends MatterbridgeAccessoryPlatform {
  cover: MatterbridgeDevice | undefined;
  //cover2: MatterbridgeDevice | undefined;

  constructor(matterbridge: Matterbridge, log: AnsiLogger) {
    super(matterbridge, log);
  }

  override async onStart(reason?: string) {
    this.log.info('onStart called with reason:', reason ?? 'none');

    this.cover = new MatterbridgeDevice(DeviceTypes.WINDOW_COVERING);
    this.cover.createDefaultIdentifyClusterServer();
    this.cover.createDefaultBasicInformationClusterServer('Accessory device', '0x59108853', 0xfff1, 'Luligu', 0x0001, 'Accessory device');
    this.cover.createDefaultPowerSourceWiredClusterServer();
    this.cover.createDefaultWindowCoveringClusterServer(10000);
    await this.registerDevice(this.cover);

    this.cover.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.log.info(`Command identify called identifyTime:${identifyTime}`);
    });

    this.cover.addCommandHandler('goToLiftPercentage', async ({ request: { liftPercent100thsValue } }) => {
      this.log.info(`Command goToLiftPercentage called liftPercent100thsValue:${liftPercent100thsValue}`);
    });

    /*
    this.cover2 = new MatterbridgeDevice(DeviceTypes.WINDOW_COVERING);
    this.cover2.createDefaultIdentifyClusterServer();
    this.cover2.createDefaultBasicInformationClusterServer('Accessory device 2', '0x59148353', 0xfff1, 'Matterbridge', 0x0001, 'Accessory device');
    this.cover2.createDefaultPowerSourceWiredClusterServer();
    this.cover2.createDefaultWindowCoveringClusterServer(10000);
    await this.registerDevice(this.cover2);
    */
  }

  override async onConfigure() {
    this.log.info('onConfigure called');

    setInterval(() => {
      if (!this.cover) return;
      const coverCluster = this.cover.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift));
      if (coverCluster && coverCluster.getCurrentPositionLiftPercent100thsAttribute) {
        let position = coverCluster.getCurrentPositionLiftPercent100thsAttribute()! + 1000;
        position = position > 10000 ? 0 : position;
        coverCluster.setTargetPositionLiftPercent100thsAttribute(position);
        coverCluster.setCurrentPositionLiftPercent100thsAttribute(position);
        coverCluster.setOperationalStatusAttribute({
          global: WindowCovering.MovementStatus.Stopped,
          lift: WindowCovering.MovementStatus.Stopped,
          tilt: WindowCovering.MovementStatus.Stopped,
        });
        this.log.info(`Set liftPercent100thsValue to ${position}`);
      }
    }, 60 * 1000);
  }

  override async onShutdown(reason?: string) {
    this.log.info('onShutdown called with reason:', reason ?? 'none');
  }
}
