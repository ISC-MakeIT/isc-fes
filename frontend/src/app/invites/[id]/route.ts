import { fetchCurrentAccount } from "@/entities/account";
import {
  HTTP_STATUS,
  loginUrl,
  Sentry,
  storeHomeUrl,
  storeInvitationsUrl,
  storeListUrl,
} from "@/shared/config";
import { storeInvitationAccept } from "./_api/store-invitation-accept";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: RouteContext<"/invites/[id]">,
) {
  const { id: invitationId } = await context.params;
  const loginPath = loginUrl(storeInvitationsUrl(invitationId));

  try {
    const account = await fetchCurrentAccount();

    if (!account) {
      return NextResponse.redirect(new URL(loginPath, request.url));
    }

    const result = await storeInvitationAccept(invitationId);

    if (result.ok) {
      return NextResponse.redirect(
        new URL(storeHomeUrl(result.storeId), request.url),
      );
    }

    if (result.status === HTTP_STATUS.UNAUTHORIZED.code) {
      return NextResponse.redirect(new URL(loginPath, request.url));
    }

    if (result.status === HTTP_STATUS.CONFLICT.code) {
      return NextResponse.redirect(new URL(storeListUrl(), request.url));
    }

    return NextResponse.json(
      { message: result.errorMessage },
      { status: result.status },
    );
  } catch (error) {
    Sentry.captureException(error);

    return NextResponse.json(
      { message: HTTP_STATUS.INTERNAL_SERVER_ERROR.message },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR.code },
    );
  }
}
