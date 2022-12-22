import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';
import { Bot, Integration, IntegrationAuth, Membership } from '../models';
import { IntegrationService } from '../services';
import { validateMembership } from '../helpers/membership';
import { UnauthorizedRequestError } from '../utils/errors';

/**
 * Validate if user on request is a member of workspace with proper roles associated
 * with the integration on request params.
 * @param {Object} obj
 * @param {String[]} obj.acceptedRoles - accepted workspace roles
 * @param {String[]} obj.acceptedStatuses - accepted workspace statuses
 */
const requireIntegrationAuth = ({
	acceptedRoles,
	acceptedStatuses
}: {
	acceptedRoles: string[];
	acceptedStatuses: string[];
}) => {
	return async (req: Request, res: Response, next: NextFunction) => {
		// integration authorization middleware

		const { integrationId } = req.params;

		// validate integration accessibility
		const integration = await Integration.findOne({
			_id: integrationId
		});

		if (!integration) {
			return next(UnauthorizedRequestError({message: 'Failed to locate Integration'}))
		}
		
		await validateMembership({
			userId: req.user._id.toString(),
			workspaceId: integration.workspace.toString(),
			acceptedRoles,
			acceptedStatuses
		});

		const integrationAuth = await IntegrationAuth.findOne({
			_id: integration.integrationAuth
		}).select(
			'+refreshCiphertext +refreshIV +refreshTag +accessCiphertext +accessIV +accessTag +accessExpiresAt'
		);

		if (!integrationAuth) {
			return next(UnauthorizedRequestError({message: 'Failed to locate Integration Authentication credentials'}))
		}

		req.integration = integration;
		req.accessToken = await IntegrationService.getIntegrationAuthAccess({
			integrationAuthId: integrationAuth._id.toString()
		});

		return next();
	};
};

export default requireIntegrationAuth;
